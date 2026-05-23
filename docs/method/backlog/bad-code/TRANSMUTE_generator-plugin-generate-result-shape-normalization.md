# TRANSMUTE generator plugin generate result shape normalization

Legacy `TASKS.md` still called out the mixed `GeneratorPlugin.generate()`
return shapes.

Done when:

- the supported return contract is explicit
- legacy ad hoc `Record<string, string>` shapes are deprecated or removed
- generators can return structured files plus adjacent evidence without custom per-generator folklore
