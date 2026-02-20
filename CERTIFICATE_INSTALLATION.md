# Kazakhstan PKI Certificate Installation

## Why this is needed
If root/intermediate certificates are missing, signing/verification may fail with errors like:

`ERROR 0x8f00040: not found root or intermediate certificate in system store`

## Recommended method (script)
Run as Administrator from repo root:

```powershell
.\install-kz-pki-certificates.ps1
```

Then restart backend/related processes.

## Manual method
1. Download official certificates from:
   - https://pki.gov.kz/
   - https://pki.gov.kz/cert/
2. Install root certs into:
   - `Local Machine -> Trusted Root Certification Authorities`
3. Install intermediate certs into:
   - `Local Machine -> Intermediate Certification Authorities`

## Verify installation
- Open `certmgr.msc` / MMC Certificates snap-in
- Confirm NCA/Kazakhstan root/intermediate certs exist in expected stores

## Notes for this project
- Frontend NCALayer-based verification/signing depends on local certificate trust chain
- Backend NKalkan verification/signing also depends on proper root/intermediate setup

## Troubleshooting
- Still failing after install:
  - ensure certs installed in **Local Machine** store
  - restart application and NCALayer
  - verify certificate validity dates and keystore password
