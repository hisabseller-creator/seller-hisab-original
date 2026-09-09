# image-size 2.0.2 security backport

The published npm package currently has no fixed release for [ICNS nontermination](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [JXL/HEIF nontermination](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq). The repository patch rejects zero/undersized/out-of-input boxes and ICNS entries before iteration, guaranteeing forward progress. It covers all 20 distributed CJS/ESM copies of the helpers/parsers, including direct type imports.

pnpm installs the integrity-locked patch via patchedDependencies. security:check verifies every patched file hash and runs crafted malformed images in a killable Worker (five-second deadline), plus valid PNG/ICNS/HEIF controls. It then runs the raw advisory scan, retaining its JSON and reporting these two entries as locally mitigated. It fails on missing/changed patches, failed fixtures, network/scan failures or any other high/critical advisory. This is a local backport, not a claim that the npm package is fixed or that the raw scan has zero findings.

Owner: repository security maintainer (assign operational contact before rollout). Review weekly alongside dependency updates. Remove the local patch and mitigation only after adopting an upstream fixed version and rerunning fixtures, compatibility and build. The original package license remains intact. Do not silently ignore these advisory IDs.
