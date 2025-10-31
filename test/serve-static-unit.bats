#!/usr/bin/env bats

load 'bats-plugins/bats-support/load'
load 'bats-plugins/bats-assert/load'

@test "contentType maps js to application/javascript" {
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('x.js'))})\""
  assert_success
  assert_output "application/javascript; charset=utf-8"
}

@test "contentType maps html to text/html" {
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('index.html'))})\""
  assert_success
  assert_output "text/html; charset=utf-8"
}

@test "contentType maps css to text/css" {
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('styles.css'))})\""
  assert_success
  assert_output "text/css; charset=utf-8"
}

@test "contentType maps png to image/png" {
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('logo.png'))})\""
  assert_success
  assert_output "image/png"
}

@test "contentType maps jpg/jpeg to image/jpeg" {
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('photo.jpg'))})\""
  assert_success
  assert_output "image/jpeg"
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('photo.jpeg'))})\""
  assert_success
  assert_output "image/jpeg"
}

@test "contentType maps svg to image/svg+xml" {
  run bash -lc "node -e \"import('{process.cwd().replace(/\\/g,'/')}/scripts/serve-static.mjs').then(m=>{console.log(m.contentType('icon.svg'))})\""
  assert_success
  assert_output "image/svg+xml"
}
