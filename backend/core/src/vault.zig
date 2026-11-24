//! AES-256-GCM envelope encryption for the Organization API Key Vault.
//! Pure cryptographic boundary: callers pass the 32-byte master key and 12-byte nonce.

const std = @import("std");
const Aes256Gcm = std.crypto.aead.aes_gcm.Aes256Gcm;

pub const Key = [Aes256Gcm.key_length]u8;
pub const Nonce = [Aes256Gcm.nonce_length]u8;
pub const Tag = [Aes256Gcm.tag_length]u8;

pub const SealedSecret = struct {
    nonce: Nonce,
    tag: Tag,
    ciphertext: []u8,

    pub fn deinit(self: SealedSecret, gpa: std.mem.Allocator) void {
        gpa.free(self.ciphertext);
    }
};

pub fn parseHexKey(hex: []const u8) !Key {
    if (hex.len != 64) return error.InvalidKeyLength;
    var key: Key = undefined;
    _ = try std.fmt.hexToBytes(&key, hex);
    return key;
}

pub fn encrypt(gpa: std.mem.Allocator, key: Key, nonce: Nonce, aad: []const u8, plaintext: []const u8) !SealedSecret {
    const ct = try gpa.alloc(u8, plaintext.len);
    errdefer gpa.free(ct);
    var tag: Tag = undefined;
    Aes256Gcm.encrypt(ct, &tag, plaintext, aad, nonce, key);
    return .{ .nonce = nonce, .tag = tag, .ciphertext = ct };
}

pub fn decrypt(gpa: std.mem.Allocator, key: Key, aad: []const u8, sealed: SealedSecret) ![]u8 {
    const pt = try gpa.alloc(u8, sealed.ciphertext.len);
    errdefer gpa.free(pt);
    try Aes256Gcm.decrypt(pt, sealed.ciphertext, sealed.tag, aad, sealed.nonce, key);
    return pt;
}

/// Returns a safe display hint (e.g. "sk-...1234") so plaintext keys never leave backend/.
pub fn maskHint(secret: []const u8, buf: []u8) []const u8 {
    if (secret.len <= 8) return "••••••••";
    return std.fmt.bufPrint(buf, "{s}…{s}", .{ secret[0..3], secret[secret.len - 4 ..] }) catch "••••••••";
}

test "vault AES-256-GCM round-trip, tamper rejection, and masking" {
    const gpa = std.testing.allocator;
    const key = try parseHexKey("00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff");
    const wrong_key = try parseHexKey("ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100");
    const nonce: Nonce = .{ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 };

    const secret = "sk-ant-api03-example-secret-9876";
    var sealed = try encrypt(gpa, key, nonce, "ANTHROPIC_API_KEY", secret);
    defer sealed.deinit(gpa);

    const opened = try decrypt(gpa, key, "ANTHROPIC_API_KEY", sealed);
    defer gpa.free(opened);
    try std.testing.expectEqualStrings(secret, opened);

    // Wrong key or wrong AAD must fail authentication loudly.
    try std.testing.expectError(error.AuthenticationFailed, decrypt(gpa, wrong_key, "ANTHROPIC_API_KEY", sealed));
    try std.testing.expectError(error.AuthenticationFailed, decrypt(gpa, key, "OPENAI_API_KEY", sealed));

    // Tampered ciphertext must fail authentication.
    sealed.ciphertext[0] ^= 0xff;
    try std.testing.expectError(error.AuthenticationFailed, decrypt(gpa, key, "ANTHROPIC_API_KEY", sealed));

    var hint_buf: [32]u8 = undefined;
    try std.testing.expectEqualStrings("sk-…9876", maskHint(secret, &hint_buf));
    try std.testing.expectEqualStrings("••••••••", maskHint("short", &hint_buf));
}
