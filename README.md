# Dots and Boxes

An attempt to build an AI to beat [Clubhouse Games™: 51 Worldwide Classics](https://www.nintendo.com/us/store/products/clubhouse-games-51-worldwide-classics-switch/) at this game.

## Build

To build, pull the repo and run `npm run install` to install the node modules. Then run `npm run build` to build to the `dist` folder.

## Params

Use `?human=[1|2]` param to specify who goes first: `human=1` or `human=2`.

Use `?debugHuman=true` param to play against two humans.

Use `?fill=[number]` to specify how many random intro moves are made (moves will not complete boxes).
