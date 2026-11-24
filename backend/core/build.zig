const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Anole core server binary (web profile includes auth, postgres, websocket, s3, jobs, openapi).
    _ = @import("anole").addApp(b, .{
        .name = "creatorstudio-core",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .profile = .web,
        .features = .{ .redis = true, .sqlite = false },
    });

    // Pure domain + vault unit tests run fast with zero external service deps.
    const test_step = b.step("test", "Run domain and vault unit tests");
    inline for (.{ "src/domain.zig", "src/vault.zig" }) |test_path| {
        const t = b.addTest(.{
            .root_module = b.createModule(.{
                .root_source_file = b.path(test_path),
                .target = target,
                .optimize = optimize,
            }),
        });
        test_step.dependOn(&b.addRunArtifact(t).step);
    }
}
