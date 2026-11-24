//! EveryAI CreatorStudio — Core Control Plane (Anole 0.6.1 / Zig 0.17)
//! Serves self-hosted Auth + RBAC, AES-256-GCM Org Key Vault, capability-typed
//! model validation, Yjs WebSocket board rooms, and SSE live status/log streams.

const std = @import("std");
const anole = @import("anole");
const auth = anole.auth;
const websocket = anole.websocket;
const domain = @import("domain.zig");
const vault = @import("vault.zig");

pub const std_options = anole.std_options;
pub const panic = anole.panic;

const log = std.log.scoped(.creatorstudio_core);

/// Declarative RBAC policy: admins inherit every manager grant plus vault & TSX deployment rights.
const rbac_policy: auth.rbac.Policy = .{
    .roles = &.{
        .{
            .name = "org:manager",
            .grants = &.{ "board:edit", "pipeline:run", "pipeline:approve", "architect:prompt" },
        },
        .{
            .name = "org:admin",
            .grants = &.{ "vault:read", "vault:write", "org:invite", "widget:approve_tsx" },
            .includes = &.{"org:manager"},
        },
    },
};

const User = struct {
    email: []const u8,
    display_name: []const u8,
    role: []const u8,
    password_hash: []const u8 = "",
};

const VaultEntry = struct {
    provider_id: []u8,
    hint: []u8,
    sealed: vault.SealedSecret,

    fn deinit(self: VaultEntry, gpa: std.mem.Allocator) void {
        gpa.free(self.provider_id);
        gpa.free(self.hint);
        self.sealed.deinit(gpa);
    }
};

const PipelineRunRecord = struct {
    run_id: []u8,
    workspace_id: []u8,
    topic: []u8,
    approval_mode: domain.ApprovalMode,
    state: domain.PipelineState,

    fn deinit(self: PipelineRunRecord, gpa: std.mem.Allocator) void {
        gpa.free(self.run_id);
        gpa.free(self.workspace_id);
        gpa.free(self.topic);
    }
};

const WidgetApproval = enum { approved, pending_admin, rejected };

const WidgetRecord = struct {
    widget_id: []u8,
    workspace_id: []u8,
    title: []u8,
    spec_type: []u8,
    spec_json: []u8,
    approval_status: WidgetApproval,

    fn deinit(self: WidgetRecord, gpa: std.mem.Allocator) void {
        gpa.free(self.widget_id);
        gpa.free(self.workspace_id);
        gpa.free(self.title);
        gpa.free(self.spec_type);
        gpa.free(self.spec_json);
    }
};

const App = struct {
    gpa: std.mem.Allocator,
    io: std.Io,
    vault_key: vault.Key,
    worker_token: []const u8,
    users: [2]User = .{
        .{ .email = "admin@everyai.studio", .display_name = "Admin", .role = "org:admin" },
        .{ .email = "wendy@everyai.studio", .display_name = "Wendy Nguyen", .role = "org:manager" },
    },
    dummy_hash: []const u8 = "",
    vault_mu: std.Io.Mutex = .init,
    secrets: std.StringHashMapUnmanaged(VaultEntry) = .empty,
    runs_mu: std.Io.Mutex = .init,
    runs: std.ArrayList(PipelineRunRecord) = .empty,
    next_run_seq: u64 = 1,
    widgets_mu: std.Io.Mutex = .init,
    widgets: std.ArrayList(WidgetRecord) = .empty,
    next_widget_seq: u64 = 1,
    db: ?*anole.pg.Client = null,
    redis: ?*anole.redis.Client = null,
    rooms: websocket.Rooms = undefined,
    events: *anole.sse.Topics = undefined,

    fn deinit(self: *App) void {
        var it = self.secrets.iterator();
        while (it.next()) |kv| {
            self.gpa.free(kv.key_ptr.*);
            kv.value_ptr.deinit(self.gpa);
        }
        self.secrets.deinit(self.gpa);
        for (self.runs.items) |r| r.deinit(self.gpa);
        self.runs.deinit(self.gpa);
        for (self.widgets.items) |w| w.deinit(self.gpa);
        self.widgets.deinit(self.gpa);
    }

    fn findUser(self: *const App, email: []const u8) ?*const User {
        for (&self.users) |*u| {
            if (std.mem.eql(u8, u.email, email)) return u;
        }
        return null;
    }
};

fn rolesOf(_: ?*anyopaque, req: *anole.Request) anyerror![]const []const u8 {
    const role = req.session.get("role") orelse return &.{};
    const out = try req.arena.alloc([]const u8, 1);
    out[0] = role;
    return out;
}

const LoginBody = struct {
    email: []const u8,
    password: []const u8,
};

fn handleLogin(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const body = try req.bind(LoginBody);
    const user = app.findUser(body.email);
    const hash = if (user) |u| u.password_hash else app.dummy_hash;
    const ok = try auth.password.verify(app.gpa, req.io, hash, body.password);
    if (!ok or user == null) return res.fail(.unauthorized, "invalid email or password");

    try req.session.set("email", user.?.email);
    try req.session.set("name", user.?.display_name);
    try req.session.set("role", user.?.role);
    try anole.session.regenerate(req);

    try res.json(.{
        .email = user.?.email,
        .display_name = user.?.display_name,
        .role = user.?.role,
    });
}

fn handleLogout(_: *App, req: *anole.Request, res: *anole.Response) !void {
    req.session.clear();
    res.status = .no_content;
}

fn handleMe(_: *App, req: *anole.Request, res: *anole.Response) !void {
    const email = req.session.get("email") orelse return res.fail(.unauthorized, "not signed in");
    try res.json(.{
        .email = email,
        .display_name = req.session.get("name") orelse "",
        .role = req.session.get("role") orelse "org:manager",
        .csrf = try auth.csrf.token(req),
    });
}

fn handleCsrf(_: *App, req: *anole.Request, res: *anole.Response) !void {
    const token = try auth.csrf.token(req);
    try res.header(auth.csrf.header_name, token);
    try res.json(.{ .csrf = token });
}

const VaultItemView = struct {
    key_name: []const u8,
    provider_id: []const u8,
    hint: []const u8,
};

fn handleVaultList(app: *App, req: *anole.Request, res: *anole.Response) !void {
    app.vault_mu.lock(req.io) catch return error.Canceled;
    defer app.vault_mu.unlock(req.io);

    var list: std.ArrayList(VaultItemView) = .empty;
    var it = app.secrets.iterator();
    while (it.next()) |kv| {
        try list.append(req.arena, .{
            .key_name = kv.key_ptr.*,
            .provider_id = kv.value_ptr.provider_id,
            .hint = kv.value_ptr.hint,
        });
    }
    try res.json(.{ .secrets = list.items });
}

const VaultPutBody = struct {
    provider_id: []const u8,
    plaintext: []const u8,
};

fn handleVaultPut(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const key_name = req.params.get("key_name") orelse return res.fail(.bad_request, "missing key_name");
    const body = try req.bind(VaultPutBody);
    if (body.plaintext.len == 0) return res.fail(.unprocessable_entity, "secret cannot be empty");

    var nonce: vault.Nonce = undefined;
    try app.io.randomSecure(&nonce);
    var sealed = try vault.encrypt(app.gpa, app.vault_key, nonce, key_name, body.plaintext);
    errdefer sealed.deinit(app.gpa);

    var hint_buf: [32]u8 = undefined;
    const hint_copy = try app.gpa.dupe(u8, vault.maskHint(body.plaintext, &hint_buf));
    errdefer app.gpa.free(hint_copy);
    const provider_copy = try app.gpa.dupe(u8, body.provider_id);
    errdefer app.gpa.free(provider_copy);

    app.vault_mu.lock(req.io) catch return error.Canceled;
    defer app.vault_mu.unlock(req.io);

    if (app.secrets.fetchRemove(key_name)) |old| {
        app.gpa.free(old.key);
        old.value.deinit(app.gpa);
    }
    const owned_key = try app.gpa.dupe(u8, key_name);
    try app.secrets.put(app.gpa, owned_key, .{
        .provider_id = provider_copy,
        .hint = hint_copy,
        .sealed = sealed,
    });

    try res.json(.{ .key_name = key_name, .provider_id = body.provider_id, .hint = hint_copy });
}

fn handleVaultDelete(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const key_name = req.params.get("key_name") orelse return res.fail(.bad_request, "missing key_name");
    app.vault_mu.lock(req.io) catch return error.Canceled;
    defer app.vault_mu.unlock(req.io);

    if (app.secrets.fetchRemove(key_name)) |old| {
        app.gpa.free(old.key);
        old.value.deinit(app.gpa);
        res.status = .no_content;
        return;
    }
    return res.fail(.not_found, "secret not found");
}

const ValidateModelBody = struct {
    node_kind: []const u8,
    provider_id: []const u8,
    model_id: []const u8,
};

fn handleValidateModel(_: *App, req: *anole.Request, res: *anole.Response) !void {
    const body = try req.bind(ValidateModelBody);
    domain.validateModelForNode(body.node_kind, body.provider_id, body.model_id) catch |err| {
        const msg = switch (err) {
            error.UnknownNodeKind => "unknown node_kind",
            error.UnknownModel => "unknown provider_id or model_id",
            error.IncompatibleCapability => "model capability is not eligible for this node kind",
        };
        return res.fail(.unprocessable_entity, msg);
    };
    try res.json(.{ .ok = true });
}

/// Relays binary Yjs CRDT updates and JSON presence frames to all other peers in the workspace.
fn handleBoardWs(app: *App, ws: *websocket.Socket, req: *anole.Request) !void {
    const ws_id = req.params.get("workspace_id") orelse "default";
    try app.rooms.join(ws_id, ws);
    defer app.rooms.leave(ws_id, ws);
    log.info("board ws joined workspace={s} peers={d}", .{ ws_id, app.rooms.count(ws_id) });

    while (true) {
        req.setTimeout(.fromSeconds(300));
        const msg = try ws.next() orelse return;
        _ = app.rooms.broadcast(ws_id, msg.type, msg.data, ws);
    }
}

const InternalEventBody = struct {
    workspace_id: []const u8,
    event_type: []const u8,
    node_id: ?[]const u8 = null,
    status: ?[]const u8 = null,
    line: ?[]const u8 = null,
};

const CreateRunBody = struct {
    workspace_id: []const u8,
    topic: []const u8,
    approval_mode: []const u8 = "gate",
};

fn handleCreateRun(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const body = try req.bind(CreateRunBody);
    if (body.topic.len == 0) return res.fail(.unprocessable_entity, "topic cannot be empty");

    const mode: domain.ApprovalMode = if (std.mem.eql(u8, body.approval_mode, "auto"))
        .auto
    else if (std.mem.eql(u8, body.approval_mode, "gate"))
        .gate
    else
        return res.fail(.unprocessable_entity, "approval_mode must be 'gate' or 'auto'");

    app.runs_mu.lock(req.io) catch return error.Canceled;
    defer app.runs_mu.unlock(req.io);

    const run_id = try std.fmt.allocPrint(app.gpa, "run_{d}", .{app.next_run_seq});
    errdefer app.gpa.free(run_id);
    app.next_run_seq += 1;

    const ws_copy = try app.gpa.dupe(u8, body.workspace_id);
    errdefer app.gpa.free(ws_copy);
    const topic_copy = try app.gpa.dupe(u8, body.topic);
    errdefer app.gpa.free(topic_copy);

    try app.runs.append(app.gpa, .{
        .run_id = run_id,
        .workspace_id = ws_copy,
        .topic = topic_copy,
        .approval_mode = mode,
        .state = .Queued,
    });

    if (app.redis) |rc| {
        const job_json = try std.fmt.allocPrint(
            req.arena,
            "{{\"job_id\":\"job_{s}\",\"run_id\":\"{s}\",\"workspace_id\":\"{s}\",\"kind\":\"screenplay\",\"topic\":\"{s}\",\"approval_mode\":\"{s}\"}}",
            .{ run_id, run_id, body.workspace_id, body.topic, @tagName(mode) },
        );
        _ = rc.command(req, .{ "LPUSH", "creatorstudio:jobs:agents", job_json }) catch |err| {
            log.warn("redis LPUSH failed: {}", .{err});
        };
    }

    _ = app.events.publishJson(body.workspace_id, null, .{
        .event_type = "node.queue_updated",
        .workspace_id = body.workspace_id,
        .node_id = "screenplay",
        .payload = .{ .status = "Queued", .line = body.topic },
    }) catch {};

    res.status = .created;
    try res.json(.{
        .run_id = run_id,
        .workspace_id = body.workspace_id,
        .topic = body.topic,
        .approval_mode = @tagName(mode),
        .state = @tagName(domain.PipelineState.Queued),
    });
}

const RunView = struct {
    run_id: []const u8,
    workspace_id: []const u8,
    topic: []const u8,
    approval_mode: []const u8,
    state: []const u8,
};

fn handleListRuns(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const ws_id = req.params.get("workspace_id") orelse return res.fail(.bad_request, "missing workspace_id");
    app.runs_mu.lock(req.io) catch return error.Canceled;
    defer app.runs_mu.unlock(req.io);

    var out: std.ArrayList(RunView) = .empty;
    for (app.runs.items) |r| {
        if (std.mem.eql(u8, r.workspace_id, ws_id)) {
            try out.append(req.arena, .{
                .run_id = r.run_id,
                .workspace_id = r.workspace_id,
                .topic = r.topic,
                .approval_mode = @tagName(r.approval_mode),
                .state = @tagName(r.state),
            });
        }
    }
    try res.json(.{ .runs = out.items });
}

fn handleApproveRun(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const run_id = req.params.get("run_id") orelse return res.fail(.bad_request, "missing run_id");
    app.runs_mu.lock(req.io) catch return error.Canceled;
    defer app.runs_mu.unlock(req.io);

    for (app.runs.items) |*r| {
        if (!std.mem.eql(u8, r.run_id, run_id)) continue;
        const next = domain.transition(r.state, .approve) orelse
            return res.fail(.conflict, "run is not waiting for approval");
        r.state = next;
        _ = app.events.publishJson(r.workspace_id, null, .{
            .event_type = "node.status_changed",
            .workspace_id = r.workspace_id,
            .node_id = "screenplay",
            .payload = .{ .status = @tagName(next), .line = "approved; advancing to voiceover" },
        }) catch {};
        try res.json(.{ .run_id = r.run_id, .state = @tagName(next) });
        return;
    }
    return res.fail(.not_found, "run not found");
}

const DecryptVaultBody = struct {
    key_name: []const u8,
};

/// Server-to-server only: decrypts an org API key for a background worker job.
fn handleInternalVaultDecrypt(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const token = req.headers.get("x-worker-token") orelse return res.fail(.unauthorized, "missing worker token");
    if (!std.mem.eql(u8, token, app.worker_token)) return res.fail(.forbidden, "invalid worker token");

    const body = try req.bind(DecryptVaultBody);
    app.vault_mu.lock(req.io) catch return error.Canceled;
    defer app.vault_mu.unlock(req.io);

    const entry = app.secrets.get(body.key_name) orelse return res.fail(.not_found, "secret not found");
    const plaintext = try vault.decrypt(req.arena, app.vault_key, body.key_name, entry.sealed);
    try res.json(.{ .key_name = body.key_name, .provider_id = entry.provider_id, .plaintext = plaintext });
}

const CreateWidgetBody = struct {
    workspace_id: []const u8,
    title: []const u8,
    spec_type: []const u8,
    spec_json: []const u8,
};

fn handleCreateWidget(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const body = try req.bind(CreateWidgetBody);
    // Security invariant: Declarative JSON deploys immediately; Sandboxed TSX ALWAYS starts pending_admin.
    const approval: WidgetApproval = if (std.mem.eql(u8, body.spec_type, "declarative_json"))
        .approved
    else if (std.mem.eql(u8, body.spec_type, "sandboxed_tsx"))
        .pending_admin
    else
        return res.fail(.unprocessable_entity, "spec_type must be 'declarative_json' or 'sandboxed_tsx'");

    app.widgets_mu.lock(req.io) catch return error.Canceled;
    defer app.widgets_mu.unlock(req.io);

    const wid = try std.fmt.allocPrint(app.gpa, "wid_{d}", .{app.next_widget_seq});
    errdefer app.gpa.free(wid);
    app.next_widget_seq += 1;

    const ws_copy = try app.gpa.dupe(u8, body.workspace_id);
    errdefer app.gpa.free(ws_copy);
    const title_copy = try app.gpa.dupe(u8, body.title);
    errdefer app.gpa.free(title_copy);
    const type_copy = try app.gpa.dupe(u8, body.spec_type);
    errdefer app.gpa.free(type_copy);
    const spec_copy = try app.gpa.dupe(u8, body.spec_json);
    errdefer app.gpa.free(spec_copy);

    try app.widgets.append(app.gpa, .{
        .widget_id = wid,
        .workspace_id = ws_copy,
        .title = title_copy,
        .spec_type = type_copy,
        .spec_json = spec_copy,
        .approval_status = approval,
    });

    res.status = .created;
    try res.json(.{
        .widget_id = wid,
        .title = body.title,
        .spec_type = body.spec_type,
        .approval_status = @tagName(approval),
    });
}

fn handleApproveWidget(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const wid = req.params.get("widget_id") orelse return res.fail(.bad_request, "missing widget_id");
    app.widgets_mu.lock(req.io) catch return error.Canceled;
    defer app.widgets_mu.unlock(req.io);

    for (app.widgets.items) |*w| {
        if (!std.mem.eql(u8, w.widget_id, wid)) continue;
        w.approval_status = .approved;
        try res.json(.{ .widget_id = w.widget_id, .approval_status = @tagName(w.approval_status) });
        return;
    }
    return res.fail(.not_found, "widget not found");
}

fn handleInternalEvent(app: *App, req: *anole.Request, res: *anole.Response) !void {
    const token = req.headers.get("x-worker-token") orelse return res.fail(.unauthorized, "missing worker token");
    if (!std.mem.eql(u8, token, app.worker_token)) return res.fail(.forbidden, "invalid worker token");

    const ev = try req.bind(InternalEventBody);
    const reached = try app.events.publishJson(ev.workspace_id, null, .{
        .event_type = ev.event_type,
        .workspace_id = ev.workspace_id,
        .node_id = ev.node_id,
        .payload = .{ .status = ev.status, .line = ev.line },
    });
    try res.json(.{ .delivered = reached });
}

pub fn main(init: std.process.Init) !void {
    const arena = init.arena.allocator();
    const port: u16 = if (init.environ_map.get("ANOLE_PORT")) |p|
        try std.fmt.parseInt(u16, p, 10)
    else
        8080;

    var state: App = .{
        .gpa = init.gpa,
        .io = undefined,
        .vault_key = undefined,
        .worker_token = init.environ_map.get("INTERNAL_WORKER_TOKEN") orelse "dev-worker-token",
    };

    var server = try anole.Server(App).init(init.gpa, .{
        .http = .{ .port = port },
        .errors = .json,
        .blocking = .{},
    }, &state);
    defer {
        server.deinit();
        state.rooms.deinit();
        state.deinit();
    }

    const io = server.io();
    state.io = io;
    state.rooms = .init(init.gpa, .{});
    state.events = try server.sseTopics(.{});

    if (init.environ_map.get("DATABASE_URL") != null) {
        state.db = try server.postgres(.{});
        log.info("PostgreSQL pool attached via DATABASE_URL", .{});
    }
    if (init.environ_map.get("REDIS_URL") != null) {
        state.redis = try server.redis(.{});
        log.info("Redis client attached via REDIS_URL", .{});
    }

    // Vault master key: from VAULT_MASTER_KEY (64 hex chars) or ephemeral dev key.
    if (init.environ_map.get("VAULT_MASTER_KEY")) |hex| {
        state.vault_key = try vault.parseHexKey(hex);
    } else {
        try io.randomSecure(&state.vault_key);
        log.warn("VAULT_MASTER_KEY unset; using ephemeral dev key (secrets will not survive restart)", .{});
    }

    // Seed dev org users with Argon2id hashes (replaced by Postgres query when DATABASE_URL is attached).
    const dev_pw = init.environ_map.get("DEV_ADMIN_PASSWORD") orelse "creatorstudio-dev";
    for (&state.users) |*u| {
        u.password_hash = try auth.password.hash(init.gpa, io, dev_pw, try arena.alloc(u8, 128));
    }
    state.dummy_hash = try auth.password.hash(init.gpa, io, "dummy-timing-guard", try arena.alloc(u8, 128));

    const session_key = if (init.environ_map.get("SESSION_KEY")) |b64|
        try anole.session.keyFromBase64(b64)
    else
        anole.session.devKey(io);
    var sessions = try anole.session.Middleware.init(.{ .key = session_key });
    var require_vault_read = auth.rbac.Require.init(&rbac_policy, "vault:read", .{ .roles = rolesOf });
    var require_vault_write = auth.rbac.Require.init(&rbac_policy, "vault:write", .{ .roles = rolesOf });

    const M = anole.Middleware(App);
    const authed = [_]M{.init(&sessions)};
    const vault_readers = [_]M{ .init(&sessions), .init(&require_vault_read) };
    const vault_writers = [_]M{ .init(&sessions), .init(&require_vault_write) };
    var require_pipeline_run = auth.rbac.Require.init(&rbac_policy, "pipeline:run", .{ .roles = rolesOf });
    var require_pipeline_approve = auth.rbac.Require.init(&rbac_policy, "pipeline:approve", .{ .roles = rolesOf });
    var require_architect = auth.rbac.Require.init(&rbac_policy, "architect:prompt", .{ .roles = rolesOf });
    var require_tsx_approve = auth.rbac.Require.init(&rbac_policy, "widget:approve_tsx", .{ .roles = rolesOf });
    const runners = [_]M{ .init(&sessions), .init(&require_pipeline_run) };
    const approvers = [_]M{ .init(&sessions), .init(&require_pipeline_approve) };
    const widget_creators = [_]M{ .init(&sessions), .init(&require_architect) };
    const tsx_approvers = [_]M{ .init(&sessions), .init(&require_tsx_approve) };

    _ = server.health(.{});
    server.use(anole.middleware.Cors.init(.{
        .origins = &.{ "http://localhost:5173", "http://127.0.0.1:5173", "tauri://localhost" },
        .credentials = true,
    }));
    server.use(anole.observe.AccessLog.init(.{}));

    server.group("/api/auth", &authed).get("/csrf", handleCsrf);
    server.group("/api/auth", &authed).post("/login", handleLogin);
    server.group("/api/auth", &authed).post("/logout", handleLogout);
    server.group("/api/auth", &authed).get("/me", handleMe);

    server.group("/api/vault", &vault_readers).get("", handleVaultList);
    server.group("/api/vault", &vault_writers).put("/:key_name", handleVaultPut);
    server.group("/api/vault", &vault_writers).delete("/:key_name", handleVaultDelete);

    server.group("/api/runs", &runners).post("", handleCreateRun);
    server.group("/api/runs", &runners).get("/:workspace_id", handleListRuns);
    server.group("/api/runs", &approvers).post("/:run_id/approve", handleApproveRun);

    server.group("/api/widgets", &widget_creators).post("", handleCreateWidget);
    server.group("/api/widgets", &tsx_approvers).post("/:widget_id/approve", handleApproveWidget);

    server.post("/api/nodes/:id/validate-model", handleValidateModel);
    server.post("/api/internal/events", handleInternalEvent);
    server.post("/api/internal/vault/decrypt", handleInternalVaultDecrypt);

    server.wsWith("/ws/board/:workspace_id", handleBoardWs, .{ .max_message_size = 4 * 1024 * 1024 });
    server.sse("/api/events/:workspace_id", state.events, .{ .topics = &.{"{workspace_id}"} });

    log.info("EveryAI CreatorStudio Core listening on :{d}", .{port});
    try server.run();
}
