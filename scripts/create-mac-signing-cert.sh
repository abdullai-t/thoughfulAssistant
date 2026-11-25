#!/bin/bash
# Create a self-signed code-signing identity in the login keychain so local
# Mac builds keep the same designated requirement across rebuilds.
# Temporary key material is written to a temp directory and deleted on exit.
# Nothing from this script is stored in the repo.
# Compatible with macOS /bin/bash 3.2.
set -euo pipefail

IDENTITY_NAME="${MAC_SIGN_IDENTITY:-InterviewOverlay Local Signing}"
KEYCHAIN="${HOME}/Library/Keychains/login.keychain-db"

if [[ ! -f "$KEYCHAIN" ]]; then
  echo "Login keychain not found at $KEYCHAIN" >&2
  exit 1
fi

if security find-identity -p codesigning 2>/dev/null | grep -F "\"${IDENTITY_NAME}\"" >/dev/null; then
  echo "Signing identity already exists: ${IDENTITY_NAME}"
  security find-identity -p codesigning 2>/dev/null | grep -F "\"${IDENTITY_NAME}\"" || true
  exit 0
fi

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/interviewoverlay-codesign.XXXXXX")"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

umask 077

cat > "$WORKDIR/cert.cnf" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_codesign
prompt = no

[req_distinguished_name]
CN = ${IDENTITY_NAME}
O = InterviewOverlay Local

[v3_codesign]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
subjectKeyIdentifier = hash
EOF

openssl genrsa -out "$WORKDIR/key.pem" 2048
openssl req -new -x509 -days 3650 -key "$WORKDIR/key.pem" -out "$WORKDIR/cert.pem" \
  -config "$WORKDIR/cert.cnf" -extensions v3_codesign

P12_PASS="$(openssl rand -base64 32)"

make_p12() {
  # $1 is optional, e.g. -legacy
  if [[ $# -gt 0 ]]; then
    openssl pkcs12 -export \
      -inkey "$WORKDIR/key.pem" \
      -in "$WORKDIR/cert.pem" \
      -out "$WORKDIR/cert.p12" \
      -name "$IDENTITY_NAME" \
      -passout "pass:${P12_PASS}" \
      "$1"
  else
    openssl pkcs12 -export \
      -inkey "$WORKDIR/key.pem" \
      -in "$WORKDIR/cert.pem" \
      -out "$WORKDIR/cert.p12" \
      -name "$IDENTITY_NAME" \
      -passout "pass:${P12_PASS}"
  fi
}

echo "Exporting PKCS#12..."
if ! make_p12 2>"$WORKDIR/p12.err"; then
  echo "Modern PKCS#12 export failed; retrying with legacy encryption."
  if ! make_p12 -legacy 2>"$WORKDIR/p12.err"; then
    echo "Failed to export a PKCS#12 file:" >&2
    cat "$WORKDIR/p12.err" >&2
    exit 1
  fi
fi

echo "Importing into the login keychain..."
if ! security import "$WORKDIR/cert.p12" \
  -k "$KEYCHAIN" \
  -f pkcs12 \
  -T /usr/bin/codesign \
  -T /usr/bin/security \
  -P "$P12_PASS"; then
  echo "Import with the first PKCS#12 format failed; retrying with legacy encryption." >&2
  make_p12 -legacy
  security import "$WORKDIR/cert.p12" \
    -k "$KEYCHAIN" \
    -f pkcs12 \
    -T /usr/bin/codesign \
    -T /usr/bin/security \
    -P "$P12_PASS"
fi

echo "Imported \"${IDENTITY_NAME}\" into the login keychain."

# User-domain trust only. Do not use -d (admin domain), which needs a GUI password.
# If this cannot run without a prompt, skip it; codesign still works with the identity.
if /usr/bin/timeout 15 security add-trusted-cert -p codeSign -k "$KEYCHAIN" "$WORKDIR/cert.pem"; then
  echo "Added user-domain code-signing trust for \"${IDENTITY_NAME}\"."
  TRUSTED=1
else
  status=$?
  echo "Could not automatically trust \"${IDENTITY_NAME}\" for code signing (exit ${status})."
  echo "This often needs a GUI admin or keychain prompt. codesign can still use the identity;"
  echo "macOS may show a prompt the first time you sign, which you should allow."
  TRUSTED=0
fi

echo
echo "Code-signing identities:"
security find-identity -p codesigning || true
if [[ "$TRUSTED" -eq 1 ]]; then
  security find-identity -v -p codesigning || true
fi
