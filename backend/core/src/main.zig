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
    rooms: websocket.Rooms = undefined,
    events: *anole.sse.Topics = undefined,

    fn deinit(self: *App) void {
        var it = self.secrets.iterator();
        while (it.next()) |kv| {
            self.gpa.free(kv.key_ptr.*);
            kv.value_ptr.deinit(self.gpa);
        }
        self.secrets.deinit(self.gpa);
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
    });
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

    _ = server.health(.{});
    server.use(anole.observe.AccessLog.init(.{}));

    server.group("/api/auth", &authed).post("/login", handleLogin);
    server.group("/api/auth", &authed).post("/logout", handleLogout);
    server.group("/api/auth", &authed).get("/me", handleMe);

    server.group("/api/vault", &vault_readers).get("", handleVaultList);
    server.group("/api/vault", &vault_writers).put("/:key_name", handleVaultPut);
    server.group("/api/vault", &vault_writers).delete("/:key_name", handleVaultDelete);

    server.post("/api/nodes/:id/validate-model", handleValidateModel);
    server.post("/api/internal/events", handleInternalEvent);

    server.wsWith("/ws/board/:workspace_id", handleBoardWs, .{ .max_message_size = 4 * 1024 * 1024 });
    server.sse("/api/events/:workspace_id", state.events, .{ .topics = &.{"{workspace_id}"} });

    log.info("EveryAI CreatorStudio Core listening on :{d}", .{port});
    try server.run();
}
