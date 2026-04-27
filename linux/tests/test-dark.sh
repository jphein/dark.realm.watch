#!/usr/bin/env bash
# Test harness for linux/dark using mock gdbus/gsettings on PATH.
set -euo pipefail

DIR=$(cd "$(dirname "$0")/.." && pwd)
DARK="$DIR/dark"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
fail() { echo "FAIL: $1"; FAIL=$((FAIL+1)); }
ok()   { echo "  ok: $1"; PASS=$((PASS+1)); }

make_mock_portal_dark() {
  cat > "$TMP/gdbus" <<'EOF'
#!/usr/bin/env bash
echo "(<<uint32 1>>,)"
EOF
  chmod +x "$TMP/gdbus"
}
make_mock_portal_light() {
  cat > "$TMP/gdbus" <<'EOF'
#!/usr/bin/env bash
echo "(<<uint32 2>>,)"
EOF
  chmod +x "$TMP/gdbus"
}
make_mock_portal_fail() {
  cat > "$TMP/gdbus" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
  chmod +x "$TMP/gdbus"
}
make_mock_gsettings_dark() {
  cat > "$TMP/gsettings" <<'EOF'
#!/usr/bin/env bash
echo "'prefer-dark'"
EOF
  chmod +x "$TMP/gsettings"
}
make_mock_gsettings_fail() {
  cat > "$TMP/gsettings" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
  chmod +x "$TMP/gsettings"
}

SEALED_PATH="$TMP:/usr/bin:/bin"

echo "test: portal returns 1 -> dark"
make_mock_portal_dark
out=$(PATH="$SEALED_PATH" "$DARK")
[ "$out" = "dark" ] && ok "portal=dark" || fail "expected 'dark', got '$out'"

echo "test: portal returns 2 -> light"
make_mock_portal_light
out=$(PATH="$SEALED_PATH" "$DARK")
[ "$out" = "light" ] && ok "portal=light" || fail "expected 'light', got '$out'"

echo "test: portal fails, gsettings returns prefer-dark -> dark"
make_mock_portal_fail
make_mock_gsettings_dark
out=$(PATH="$SEALED_PATH" "$DARK")
[ "$out" = "dark" ] && ok "fallback=dark" || fail "expected 'dark', got '$out'"

echo "test: both fail -> unknown, exit 1"
make_mock_portal_fail
make_mock_gsettings_fail
set +e
out=$(PATH="$SEALED_PATH" "$DARK")
rc=$?
set -e
[ "$out" = "unknown" ] && [ "$rc" = "1" ] && ok "unknown+exit1" || fail "got '$out' exit=$rc"

echo "test: --help exits 0 with usage"
out=$(PATH="$SEALED_PATH" "$DARK" --help)
echo "$out" | grep -q "Usage:" && ok "help" || fail "no Usage in --help output"

echo "test: unknown subcommand exits 2"
set +e
PATH="$SEALED_PATH" "$DARK" bogus >/dev/null 2>&1
rc=$?
set -e
[ "$rc" = "2" ] && ok "bogus exits 2" || fail "expected exit 2, got $rc"

echo
echo "PASS: $PASS   FAIL: $FAIL"
[ "$FAIL" = "0" ] || exit 1
