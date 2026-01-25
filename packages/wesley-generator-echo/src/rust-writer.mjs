export class RustWriter {
  constructor() {
    this.lines = [];
    this.indentCheck = 0;
  }

  indent() {
    this.indentCheck++;
  }

  dedent() {
    if (this.indentCheck > 0) {
      this.indentCheck--;
    }
  }

  write(text = '') {
    const spaces = '    '.repeat(this.indentCheck);
    this.lines.push(`${spaces}${text}`);
  }

  writeLine(text = '') {
    this.write(text);
  }

  writeAttributes(attrs) {
    if (attrs && attrs.length > 0) {
      for (const attr of attrs) {
        this.writeLine(`#[${attr}]`);
      }
    }
  }

  writeEnum(name, variants, attributes = []) {
    this.writeAttributes(attributes);
    this.writeLine(`pub enum ${name} {`);
    this.indent();
    for (const variant of variants) {
      this.writeLine(`${variant},`);
    }
    this.dedent();
    this.writeLine(`}`);
    this.writeLine();
  }

  writeStruct(name, fields, attributes = []) {
    this.writeAttributes(attributes);
    this.writeLine(`pub struct ${name} {`);
    this.indent();
    for (const field of fields) {
      const typeStr = field.optional ? `Option<${field.type}>` : field.type;
      this.writeLine(`pub ${field.name}: ${typeStr},`);
    }
    this.dedent();
    this.writeLine(`}`);
    this.writeLine();
  }

  toString() {
    return this.lines.join('\n');
  }
}