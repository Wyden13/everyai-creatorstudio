//! EveryAI CreatorStudio — Core Control Plane (Anole / Zig)
//! Milestone 0 bootstrap: explicit pipeline state transitions & capability rules.
//! In Milestone 1, wire `zig fetch --save git+https://github.com/xuckless/anole#v0.6.1`
//! with `-Dauth=true -Dpostgres=true -Dredis=true -Dwebsocket=true -Ds3=true -Djobs=true`.

const std = @import("std");

pub const PipelineState = enum {
    Idle,
    Queued,
    Running,
    NeedsApproval,
    Failed,
    Done,

    pub fn canTransition(self: PipelineState, next: PipelineState) bool {
        return switch (self) {
            .Idle => next == .Queued or next == .Running,
            .Queued => next == .Running or next == .Failed or next == .Idle,
            .Running => next == .NeedsApproval or next == .Done or next == .Failed,
            .NeedsApproval => next == .Running or next == .Done or next == .Failed or next == .Idle,
            .Failed => next == .Queued or next == .Running or next == .Idle,
            .Done => next == .Queued or next == .Running or next == .Idle,
        };
    }
};

pub const Capability = enum {
    llm_text,
    llm_code,
    tts,
    search,
    publish,
};

pub fn isCapabilityAllowed(node_kind: []const u8, cap: Capability) bool {
    if (std.mem.eql(u8, node_kind, "voiceover")) return cap == .tts;
    if (std.mem.eql(u8, node_kind, "screenplay")) return cap == .llm_text;
    if (std.mem.eql(u8, node_kind, "animation_remotion")) return cap == .llm_code;
    if (std.mem.eql(u8, node_kind, "animation_manim")) return cap == .llm_code;
    if (std.mem.eql(u8, node_kind, "architect")) return cap == .llm_code or cap == .llm_text;
    if (std.mem.eql(u8, node_kind, "trend_scout")) return cap == .search or cap == .llm_text;
    if (std.mem.eql(u8, node_kind, "publisher")) return cap == .publish or cap == .llm_text;
    return false;
}

pub fn main() !void {
    std.debug.print("EveryAI CreatorStudio Core (Anole/Zig bootstrap) ready.\n", .{});
}

test "explicit pipeline state machine transitions" {
    try std.testing.expect(PipelineState.Idle.canTransition(.Queued));
    try std.testing.expect(PipelineState.Running.canTransition(.NeedsApproval));
    try std.testing.expect(!PipelineState.Idle.canTransition(.Done));
    try std.testing.expect(!PipelineState.Queued.canTransition(.NeedsApproval));
}

test "capability routing forbids cross-capability assignments" {
    try std.testing.expect(isCapabilityAllowed("voiceover", .tts));
    try std.testing.expect(!isCapabilityAllowed("voiceover", .llm_code));
    try std.testing.expect(isCapabilityAllowed("animation_remotion", .llm_code));
    try std.testing.expect(!isCapabilityAllowed("animation_remotion", .tts));
    try std.testing.expect(!isCapabilityAllowed("screenplay", .tts));
}
