---
title: Calling C Code in Zig 0.16
excerpt: How to import and call C code in Zig.
publishDate: 'Jun 15 2026'
isFeatured: true
tags:
  - Guide
  - Zig
---

Zig is the hot new "C alternative", and one of it's standout feature is how easy
it is to interop with C. To demonstrate how we are going to call curl from Zig!

### Prepare the build

Create the following file in your source directory:

```c
// src/c.h
#include <curl/curl.h>
```

this is where you import all the libraries you wish to use

Zig needs to know how to build and where to find curl:

```zig
// build.zig
const curl = b.addTranslateC(.{
    .target = target,
    .optimize = optimize,
    .root_source_file = b.path("src/c.h"),
    .link_libc = true,
});
curl.linkSystemLibrary("curl", .{});
// you can link libc here in case your library needs it
```

### Import your C library

inside your Zig file you can now import the library:

```zig
const std = @import("std");
const curl = @import("curl");

pub fn main(init: std.process.Init) !void {
    const args = try init.minimal.args.toSlice(init.arena.allocator());

    if (args.len < 2) {
        return error.NoArgumentGivent;
    }

    const addr = args[1];
    const n_alloc = 1000;
    const allocation = try init.arena.allocator().alloc(u8, n_alloc);
    var response: Response = .{ .data = allocation.ptr, .nbytes = 0 };

    const handle: *curl.CURL = curl.curl_easy_init() orelse return error.CurlInitError;
    defer curl.curl_easy_cleanup(handle);

    _ = curl.curl_easy_setopt(handle, curl.CURLOPT_URL, addr.ptr);
    _ = curl.curl_easy_setopt(handle, curl.CURLOPT_FOLLOWLOCATION, @as(c_long, 1));
    _ = curl.curl_easy_setopt(handle, curl.CURLOPT_WRITEFUNCTION, write_data);
    _ = curl.curl_easy_setopt(handle, curl.CURLOPT_WRITEDATA, @as(*anyopaque, @ptrCast(&response)));

    print("curling: {s}\n", .{addr});

    const result = curl.curl_easy_perform(handle);
    if (result != curl.CURLE_OK) {
        std.log.err("{s}\n", .{curl.curl_easy_strerror(result)});
        return error.CurlError;
    }

    print("received response:\n{s}\n", .{response.data[0..response.nbytes]});
}
```

make sure to respect the different semantics! Zig provides a dedicated C pointer
type and a directive for a C compatible call convention.

```zig
// callback for curl
fn write_data(ptr: [*c]u8, size_t: usize, nmemb: usize, userdata: *anyopaque) callconv(.c) usize
```

and really its as easy as that, you can find the source code [here](https://github.com/Reza-Darius/zigcurl/blob/main/src/main.zig).


