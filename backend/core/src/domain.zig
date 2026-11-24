//! Pure domain rules for EveryAI CreatorStudio core.
//! Declarative data tables drive pipeline state transitions and model capability routing.

const std = @import("std");

pub const PipelineState = enum {
    Idle,
    Queued,
    Running,
    NeedsApproval,
    Failed,
    Done,
};

pub const PipelineEvent = enum {
    enqueue,
    start,
    request_approval,
    approve,
    complete,
    fail,
    reset,
};

const TransitionRow = struct {
    from: PipelineState,
    event: PipelineEvent,
    to: PipelineState,
};

/// Every legal pipeline transition is a row here; add new behavior as a state or row,
/// never as an ad-hoc branch in handlers.
pub const TRANSITIONS = [_]TransitionRow{
    .{ .from = .Idle, .event = .enqueue, .to = .Queued },
    .{ .from = .Idle, .event = .start, .to = .Running },
    .{ .from = .Queued, .event = .start, .to = .Running },
    .{ .from = .Queued, .event = .fail, .to = .Failed },
    .{ .from = .Queued, .event = .reset, .to = .Idle },
    .{ .from = .Running, .event = .request_approval, .to = .NeedsApproval },
    .{ .from = .Running, .event = .complete, .to = .Done },
    .{ .from = .Running, .event = .fail, .to = .Failed },
    .{ .from = .NeedsApproval, .event = .approve, .to = .Running },
    .{ .from = .NeedsApproval, .event = .complete, .to = .Done },
    .{ .from = .NeedsApproval, .event = .fail, .to = .Failed },
    .{ .from = .NeedsApproval, .event = .reset, .to = .Idle },
    .{ .from = .Failed, .event = .enqueue, .to = .Queued },
    .{ .from = .Failed, .event = .start, .to = .Running },
    .{ .from = .Failed, .event = .reset, .to = .Idle },
    .{ .from = .Done, .event = .enqueue, .to = .Queued },
    .{ .from = .Done, .event = .start, .to = .Running },
    .{ .from = .Done, .event = .reset, .to = .Idle },
};

pub fn transition(current: PipelineState, event: PipelineEvent) ?PipelineState {
    for (TRANSITIONS) |row| {
        if (row.from == current and row.event == event) return row.to;
    }
    return null;
}

pub const Capability = enum {
    llm_text,
    llm_code,
    tts,
    search,
    publish,
};

const NodeRule = struct {
    node_kind: []const u8,
    allowed: []const Capability,
};

/// Canonical node-to-capability table matching shared/model-registry.json.
/// Add new node kinds as rows here; never branch on node_kind in handlers.
pub const NODE_RULES = [_]NodeRule{
    .{ .node_kind = "trend_scout", .allowed = &.{ .search, .llm_text } },
    .{ .node_kind = "screenplay", .allowed = &.{.llm_text} },
    .{ .node_kind = "voiceover", .allowed = &.{.tts} },
    .{ .node_kind = "animation_remotion", .allowed = &.{.llm_code} },
    .{ .node_kind = "animation_manim", .allowed = &.{.llm_code} },
    .{ .node_kind = "architect", .allowed = &.{ .llm_code, .llm_text } },
    .{ .node_kind = "publisher", .allowed = &.{ .publish, .llm_text } },
};

pub const ModelSpec = struct {
    provider_id: []const u8,
    model_id: []const u8,
    secret_key_name: []const u8,
    capabilities: []const Capability,
};

/// Canonical provider/model capability table matching shared/model-registry.json.
pub const MODEL_SPECS = [_]ModelSpec{
    .{ .provider_id = "anthropic", .model_id = "claude-sonnet-4-5", .secret_key_name = "ANTHROPIC_API_KEY", .capabilities = &.{ .llm_text, .llm_code } },
    .{ .provider_id = "anthropic", .model_id = "claude-opus-4-5", .secret_key_name = "ANTHROPIC_API_KEY", .capabilities = &.{ .llm_text, .llm_code } },
    .{ .provider_id = "anthropic", .model_id = "claude-haiku-4-5", .secret_key_name = "ANTHROPIC_API_KEY", .capabilities = &.{ .llm_text, .llm_code } },
    .{ .provider_id = "openai", .model_id = "gpt-4o", .secret_key_name = "OPENAI_API_KEY", .capabilities = &.{ .llm_text, .llm_code } },
    .{ .provider_id = "openai", .model_id = "o3", .secret_key_name = "OPENAI_API_KEY", .capabilities = &.{ .llm_text, .llm_code } },
    .{ .provider_id = "openai", .model_id = "gpt-4o-mini-tts", .secret_key_name = "OPENAI_API_KEY", .capabilities = &.{.tts} },
    .{ .provider_id = "google_gemini", .model_id = "gemini-2.5-pro", .secret_key_name = "GEMINI_API_KEY", .capabilities = &.{ .llm_text, .llm_code } },
    .{ .provider_id = "google_gemini", .model_id = "gemini-2.5-flash", .secret_key_name = "GEMINI_API_KEY", .capabilities = &.{ .llm_text, .llm_code } },
    .{ .provider_id = "elevenlabs", .model_id = "eleven_multilingual_v2", .secret_key_name = "ELEVENLABS_API_KEY", .capabilities = &.{.tts} },
    .{ .provider_id = "elevenlabs", .model_id = "eleven_turbo_v2_5", .secret_key_name = "ELEVENLABS_API_KEY", .capabilities = &.{.tts} },
    .{ .provider_id = "google_tts", .model_id = "google-chirp3-hd", .secret_key_name = "GOOGLE_TTS_API_KEY", .capabilities = &.{.tts} },
    .{ .provider_id = "google_tts", .model_id = "google-neural2", .secret_key_name = "GOOGLE_TTS_API_KEY", .capabilities = &.{.tts} },
    .{ .provider_id = "serpapi", .model_id = "google-trends-news", .secret_key_name = "SERPAPI_KEY", .capabilities = &.{.search} },
    .{ .provider_id = "exa", .model_id = "exa-neural", .secret_key_name = "EXA_API_KEY", .capabilities = &.{.search} },
    .{ .provider_id = "tavily", .model_id = "tavily-search", .secret_key_name = "TAVILY_API_KEY", .capabilities = &.{.search} },
    .{ .provider_id = "youtube", .model_id = "youtube-v3", .secret_key_name = "YOUTUBE_OAUTH_TOKEN", .capabilities = &.{.publish} },
    .{ .provider_id = "ayrshare", .model_id = "ayrshare-social", .secret_key_name = "AYRSHARE_API_KEY", .capabilities = &.{.publish} },
};

pub const ModelCheckError = error{
    UnknownNodeKind,
    UnknownModel,
    IncompatibleCapability,
};

pub fn validateModelForNode(node_kind: []const u8, provider_id: []const u8, model_id: []const u8) ModelCheckError!void {
    const allowed = for (NODE_RULES) |rule| {
        if (std.mem.eql(u8, rule.node_kind, node_kind)) break rule.allowed;
    } else return error.UnknownNodeKind;

    const model_caps = for (MODEL_SPECS) |spec| {
        if (std.mem.eql(u8, spec.provider_id, provider_id) and std.mem.eql(u8, spec.model_id, model_id)) {
            break spec.capabilities;
        }
    } else return error.UnknownModel;

    for (model_caps) |mc| {
        for (allowed) |ac| {
            if (mc == ac) return;
        }
    }
    return error.IncompatibleCapability;
}

test "pipeline state transition table covers legal and rejected transitions" {
    const Case = struct {
        from: PipelineState,
        event: PipelineEvent,
        expected: ?PipelineState,
    };
    const cases = [_]Case{
        .{ .from = .Idle, .event = .enqueue, .expected = .Queued },
        .{ .from = .Idle, .event = .start, .expected = .Running },
        .{ .from = .Idle, .event = .complete, .expected = null },
        .{ .from = .Idle, .event = .approve, .expected = null },
        .{ .from = .Queued, .event = .start, .expected = .Running },
        .{ .from = .Queued, .event = .request_approval, .expected = null },
        .{ .from = .Running, .event = .request_approval, .expected = .NeedsApproval },
        .{ .from = .Running, .event = .complete, .expected = .Done },
        .{ .from = .Running, .event = .fail, .expected = .Failed },
        .{ .from = .Running, .event = .enqueue, .expected = null },
        .{ .from = .NeedsApproval, .event = .approve, .expected = .Running },
        .{ .from = .NeedsApproval, .event = .reset, .expected = .Idle },
        .{ .from = .Failed, .event = .enqueue, .expected = .Queued },
        .{ .from = .Done, .event = .reset, .expected = .Idle },
    };
    for (cases) |c| {
        try std.testing.expectEqual(c.expected, transition(c.from, c.event));
    }
}

test "capability routing table allows eligible models and rejects mismatches" {
    const Case = struct {
        node: []const u8,
        provider: []const u8,
        model: []const u8,
        expected: ?ModelCheckError,
    };
    const cases = [_]Case{
        .{ .node = "voiceover", .provider = "elevenlabs", .model = "eleven_multilingual_v2", .expected = null },
        .{ .node = "voiceover", .provider = "google_tts", .model = "google-chirp3-hd", .expected = null },
        .{ .node = "voiceover", .provider = "openai", .model = "gpt-4o-mini-tts", .expected = null },
        .{ .node = "voiceover", .provider = "anthropic", .model = "claude-sonnet-4-5", .expected = error.IncompatibleCapability },
        .{ .node = "animation_remotion", .provider = "anthropic", .model = "claude-sonnet-4-5", .expected = null },
        .{ .node = "animation_remotion", .provider = "elevenlabs", .model = "eleven_multilingual_v2", .expected = error.IncompatibleCapability },
        .{ .node = "screenplay", .provider = "google_gemini", .model = "gemini-2.5-pro", .expected = null },
        .{ .node = "screenplay", .provider = "elevenlabs", .model = "eleven_turbo_v2_5", .expected = error.IncompatibleCapability },
        .{ .node = "architect", .provider = "openai", .model = "o3", .expected = null },
        .{ .node = "architect", .provider = "google_tts", .model = "google-neural2", .expected = error.IncompatibleCapability },
        .{ .node = "unknown_node", .provider = "openai", .model = "gpt-4o", .expected = error.UnknownNodeKind },
        .{ .node = "screenplay", .provider = "openai", .model = "nonexistent", .expected = error.UnknownModel },
    };
    for (cases) |c| {
        if (c.expected) |err| {
            try std.testing.expectError(err, validateModelForNode(c.node, c.provider, c.model));
        } else {
            try validateModelForNode(c.node, c.provider, c.model);
        }
    }
}
