# wesley-holmes-domain

Part of [Wesley](https://github.com/flyingrobots/wesley#readme). The pure domain
of Holmes, Wesley's law-assurance library: the data model, deterministic
validation, policy, and diagnostics. `wesley-holmes` re-exports it as
`wesley_holmes::domain`, which is the path to use.

It is a separate crate for one reason: so that its boundary is enforced and not
merely agreed. The domain must not touch the filesystem, the network, processes,
the environment, or a clock, because its results have to be the same on every
machine and every run. It is not published.
