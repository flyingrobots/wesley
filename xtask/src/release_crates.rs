//! The crates a release covers: the five that are published, in dependency
//! order, and the unpublished ones that still carry the release version.

pub(crate) struct PublishCrate {
    pub(crate) name: &'static str,
    pub(crate) path: &'static str,
    pub(crate) dependencies: &'static [&'static str],
}

pub(crate) struct CargoVersionSource {
    pub(crate) name: &'static str,
    pub(crate) path: &'static str,
    pub(crate) publish: bool,
}

pub(crate) const PUBLISH_CRATES: &[PublishCrate] = &[
    PublishCrate {
        name: "wesley-core",
        path: "crates/wesley-core",
        dependencies: &[],
    },
    PublishCrate {
        name: "wesley-emit-codec",
        path: "crates/wesley-emit-codec",
        dependencies: &["wesley-core"],
    },
    PublishCrate {
        name: "wesley-emit-rust",
        path: "crates/wesley-emit-rust",
        dependencies: &["wesley-core", "wesley-emit-codec"],
    },
    PublishCrate {
        name: "wesley-emit-typescript",
        path: "crates/wesley-emit-typescript",
        dependencies: &["wesley-core", "wesley-emit-codec"],
    },
    PublishCrate {
        name: "wesley-cli",
        path: "crates/wesley-cli",
        dependencies: &["wesley-core", "wesley-emit-rust", "wesley-emit-typescript"],
    },
];
pub(crate) const UNPUBLISHED_CARGO_VERSION_SOURCES: &[CargoVersionSource] = &[
    CargoVersionSource {
        name: "wesley-holmes-domain",
        path: "crates/wesley-holmes-domain",
        publish: false,
    },
    CargoVersionSource {
        name: "wesley-holmes",
        path: "crates/wesley-holmes",
        publish: false,
    },
];
