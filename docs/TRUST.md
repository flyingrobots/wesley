# TRUST & Certificates

Wesley emits evidence artifacts (bundle, scores, SHIPME) to build trust in generated plans. Certificates include hashes and metadata so deployments are auditable, and SHIPME now summarizes citation quality so exact evidence, whole-file fallbacks, and coarse citations are visible instead of flattened into one trust signal. That trust summary now affects HOLMES/WATSON judgment too: coarse citations downgrade “all clear” style conclusions to further investigation instead of hiding behind pretty percentages.

In CI, HOLMES/Watson consume the bundle to investigate/verify/predict. See `.github/workflows/wesley-holmes.yml` for the flow. Scores are non-blocking until artifacts are consistently present.
