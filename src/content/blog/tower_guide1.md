---
title: Building HTTP services with Tower; or how i stopped worrying and learned to love generics.
excerpt: Guide for building HTTP services with Tower and Hyper.
publishDate: 'May 29 2026'
isFeatured: true
tags:
  - Guide
  - Rust
  - Hyper
  - Tower
---

Rust is a great fit for web services and network applications with it's awesome type system and the performance to boot.
Tower enjoys broad ecosystem support, as it is an official Tokio library, so it seemed like a sensible choice for my [reverse proxy](https://github.com/Reza-Darius/porto), however i very quickly found out that Tower is anything but easy to use.

The sheer amount of generics involved eliminate one of Rust's best features: the compiler guiding you. I hope to save you from some of the pitfalls i encountered along the way.

### The (not so) humble `Service` trait

The heart of Tower is the `Service` trait:

```rust
pub trait Service<Input> {
    type Response;
    type Error;
    type Future: Future<Output = Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>,) -> Poll<Result<(), Self::Error>>;
    fn call(&mut self, req: Request) -> Self::Future;
}
```

A uniform interface for a "service" (what a service is is quite broad) through which libraries and APIs can talk to each other.

Starting from the top, `Service` is generic over a generic type, which can really be anything and should be thought of as the input type for our service. In the case of HTTP, the input can be a request hitting our server.

`Response` and `Error` represent the output of our service, with the `Future` resolving to said output. The associated future might strike you as odd. It is a vestigial of a time before async traits were a thing.

The `poll_ready()` method usually gets called before `call()` and is primarily used for back pressure.

We can either implement `Service` directly for a struct, or use the `service_fn()` function to create a service from a function or closure.

However this version of the `Service` trait isn't all that useful, you call it once and you're done.

The reason its called tower is because the whole point of Tower is to stack
services on top of each other...like a tower. So let's see how to do that.

### Playing Jenga

This snippet is taken from the [axum documentation](https://docs.rs/axum/latest/axum/middleware/index.html#towerservice-and-pinboxdyn-future), and serves as a great template for writing your own tower services or middleware.

```rust
#[derive(Clone)]
struct MyLayer;

impl<S> Layer<S> for MyLayer {
    type Service = MyMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        MyMiddleware { inner }
    }
}

#[derive(Clone)]
struct MyMiddleware<S> {
    inner: S,
}

impl<S> Service<Request> for MyMiddleware<S>
where
    S: Service<Request, Response = Response> + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    // `BoxFuture` is a type alias for `Pin<Box<dyn Future + Send + 'a>>`
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }
    fn call(&mut self, request: Request) -> Self::Future {
        Box::pin( async {
          // ..
        })
    }
}
```

There is a lot going on here so let's start from the top:

`MyLayer` is a struct that acts the constructor for `ServiceBuilder` which we will use later to build our tower stack. `Layer` is the trait that tells tower how to nest services.

```rust
let app = ServiceBuilder::new()
	.layer(MyLayer::new()) // calls "some_service"
	.service(some_service) // this last service doesnt nest anything
```

### Stateful services

Hyper and Axum work like this: every Request gets its own Tokio Task and clone of a service.

Service objects (including the layer) should therefore be cheaply clonable. Not implementing `Clone` at all will hit you with a nasty compile error.

You want to put initialization logic in the constructor of the layer like so:

```rust
// example Layer

#[derive(Debug, Clone)]
pub struct AddrServiceLayer {
    state: Arc<HashMap<..>>,
}

impl AddrServiceLayer {
    pub fn new() -> Self {
        AddrServiceLayer { state: Arc::new(HashMap::new()) }
    }
}

impl<S> Layer<S> for AddrServiceLayer {
    type Service = AddrService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AddrService {
            inner,
            state: self.state.clone(),
        }
    }
}
```

### Untangling generics

The `<S>` generic parameter is the idiomatic way to designate the nested service that your service wraps. And here is where things get interesting.

```rust
impl<S> Service<Request> for MyMiddleware<S>
where
    S: Service<Request, Response = Response>,
```

The service we implement takes in a concrete type `Request`, an HTTP request, and wraps a service `S`.

We are declaring that the service we wish to wrap takes in the same `Request` type as input and produces a `Response`.

This already has profound implications for our service stack. By naming concrete types (which we don't have to do) we are narrowing down where our service can be positioned in the stack!

Consider the following signature of a different service:

```rust
impl Service<String> for HelloService {
    type Response = String
    // ...
}
```

`MyMiddleware` and `HelloService` would not compose with each other, because `MyMiddleware` expects a service that takes in a `Request` and produces a `Response`.

```rust
let app = ServiceBuilder::new()
	.layer(MyMiddleware::new())
	.service(HelloService::new()) // compile error!
```

I want to stress this concept because the compiler error is going to be utterly incomprehensible!

To make it work we'd have to change out signature like so:

```rust
impl<S> Service<Request> for MyMiddleware<S>
where
    S: Service<String, Response = String>,
```

Indeed, composing your services in a way where they change the inputs and outputs types is quite a powerful idea and libraries like Hyper make use of all the time!

The big takeaway: naming concrete types in the service signature makes your service easier to reason about but less flexible when putting them together.

### Error handling

In our example we are bubbling up the error the inner service spits out.

```rust
type Error = S::Error;
```

Howerver at some point you have to handle the error.
There are different strategies for error handling depending on the application.

When using Hyper (and by extension Axum) an error will hard terminate the connection. This is generally undesirable which is why Axum requires services to return `Infallible`.
Therefore it's a good idea to _not_ return errors, but rather HTTP responses with an appropriate error code.

When interacting with third party libraries you can't assume that they will do this (they never do in fact), so you could implement a service which converts errors into responses. There are helpful modules in the `tower_http` crate for this sort of functionality like a [panic handler](https://docs.rs/tower-http/latest/tower_http/catch_panic/index.html).

### Back to the future

Lets expand the snippet:

```rust
impl<S> Service<Request> for MyMiddleware<S>
where
    S: Service<Request, Response = Response> + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    // `BoxFuture` is a type alias for `Pin<Box<dyn Future + Send + 'a>>`
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;
```

You want the wrapped service and its associated future to be `Send` and `'static`, so just add those every time. I know i hate it too, but that's what we gotta do...

For the `Future` type you two options: Roll your own future struct or just box it. The latter is easier but costs you an additional allocation.

When in doubt, box it!

### Wrapping up

With that we have a fully working service:

```rust
#[derive(Clone)]
struct MyLayer;

impl<S> Layer<S> for MyLayer {
    type Service = MyMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        MyMiddleware { inner }
    }
}

#[derive(Clone)]
struct MyMiddleware<S> {
    inner: S,
}

impl<S> Service<Request> for MyMiddleware<S>
where
    S: Service<Request, Response = Response> + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = BoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request) -> Self::Future {
        let fut = self.inner.call(request);
        Box::pin( move async {
            println!("hello from my middleware!");
            fut.await
        })
    }
}
```

Notice how much boilerplate we had to go through for, what is essentially, one line of business logic?
It pays having these templates ready and adjust the parts as needed.

Join me for Part 2 where we look at how to roll your own futures to avoid allocations.

