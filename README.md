# Cycle-Router

This is a router driver for cycle.js

# Installation
`npm install cycle-router`

# Example
```javascript
import {run, Rx} from '@cycle/core';
import {h, makeDOMDriver} from '@cycle/dom';
import {makeRouterDriver} from 'cycle-router';

let Routes = {
  "authors": "/authors",
  "books": "/books",
  "books.view": "/books/view/:bookId"
}

function createView(text) {
  return h('div', [
    h('ul', [
      h('li',[h('a', {href: "/authors"}, 'Authors')]),
      h('li',[h('a', {href: "/books"}, 'Books')]),
      h('li',[h('a', {href: "/books/view/33"}, "Book 33")]),
      h('li',[h('a', {href: "/books/view/33/chapter/44"}, "Book 33 Chapter 44")])
    ]),
    h('h1', text)
  ]);
}

function main({DOM, Router}) {

  let currentRoute$ = DOM.select('a').events('click')
    .map(event => event.target.href)
    .startWith(location.href)
    .map(route => route)

  let text$ = new Rx.Subject();
  Router
    .addRoutes(Routes)
    .addRoute("books.view.chapter", "/books/view/:bookId/chapter/:chapterNum")
    .on("authors", () => {
      text$.onNext("Authors");
    })
    .on("books", () => {
      text$.onNext("Books");
    })
    .on("books.view", ({bookId}) => {
      text$.onNext(`BookId: ${bookId}`);
    })
    .on("books.view.chapter", ({bookId, chapterNum}) => {
      text$.onNext(`BookId: ${bookId}, Chapter: ${chapterNum}`);
    });

  let view$ = text$.map(
    (text) => {
      return createView(text);
    }
  );

  return {
    DOM: view$,
    Router: currentRoute$
  }
}

let drivers = {
  DOM: makeDOMDriver('.app'),
  Router: makeRouterDriver()
}

run(main, drivers);
```

# API

## Driver

### ```makeRouterDriver()```

###### Return

(Function) The Router Driver function. It expects an Observable of the current route you would like to set as input, and outputs an instance of Router.

## Router

#### Methods

####`addRoutes(routes)`
  Adds multipls routes from object, where keys should be the name of route, and values should be the path to match against.
  ```javascript
  Router.addRoutes({
    "authors": "/authors",
    "books": "/books",
    "books.view": "/books/view/:bookId",
    ...
  });
  ```
####`addRoute(name, path)`
  Adds a single route.

  ```javascript
  Router.addRoute("books", "/books");
  ```

####`on(name, handlerFn)`
  Listens for route change for route `name`.

  The handler function will be passed an object with any parameters defined in the route.

  ```javascript
  Router.on('books.view', ({bookId}) => {...});
  ```

####`setRoute(path)`
  Sets the route to `path`.
  Will trigger any subscriptions associated to the route.

  ```javascript
  Router.setRoute('/books')
  ```

#### Properties

#### `params$`
  This is an observable which emits an object with any parameters defined on the current route

  ```javascript
  Router.params$.map((params) => {...});
  ```
