/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import {
    Observable,
    catchError,
    filter,
    fromEvent,
    interval,
    map,
    scan,
    switchMap,
    take,
    merge,
    reduce,
} from "rxjs";
import { fromFetch } from "rxjs/fetch";

/** Constants */

const Viewport = {
    CANVAS_WIDTH: 600,
    CANVAS_HEIGHT: 400,
} as const;

const Birb = {
    WIDTH: 42,
    HEIGHT: 30,
} as const;

const Constants = {
    PIPE_WIDTH: 50,
    TICK_RATE_MS: 16, // Might need to change this!
} as const;

// User input

type Key = "Space";

// State processing

type State = Readonly<{
    gameEnd: boolean;
    birbPosition: number;
    birbVelocity: number;
    birbLives: number;
    gapY: number;
    gapHeight: number;
    time: number;
    pipeX: number;
}>;

const initialState: State = {
    gameEnd: false,
    birbPosition: 200,
    birbVelocity: 0,
    birbLives: 3,
    gapY: 0,
    gapHeight: 0,
    time: 0,
    pipeX: Viewport.CANVAS_WIDTH,
};

type Pipe = Readonly<{
    gapY: number;
    gapHeight: number;
    time: number;
}>;

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

// Rendering (side effects)

/**
 * Brings an SVG element to the foreground.
 * @param elem SVG element to bring to the foreground
 */
const bringToForeground = (elem: SVGElement): void => {
    elem.parentNode?.appendChild(elem);
};

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "visible");
    bringToForeground(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGElement): void => {
    elem.setAttribute("visibility", "hidden");
};

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
): SVGElement => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

const render = (): ((s: State) => void) => {
    // Canvas elements
    const gameOver = document.querySelector("#gameOver") as SVGElement;
    const container = document.querySelector("#main") as HTMLElement;

    // Text fields
    const livesText = document.querySelector("#livesText") as HTMLElement;
    const scoreText = document.querySelector("#scoreText") as HTMLElement;

    const svg = document.querySelector("#svgCanvas") as SVGSVGElement;

    svg.setAttribute(
        "viewBox",
        `0 0 ${Viewport.CANVAS_WIDTH} ${Viewport.CANVAS_HEIGHT}`,
    );
    /**
     * Renders the current state to the canvas.
     *
     * In MVC terms, this updates the View using the Model.
     *
     * @param s Current state
     */

    const previousBirdImg = svg.querySelector("image"); // Select the old bird image
    if (previousBirdImg) {
        svg.removeChild(previousBirdImg); // Remove the old bird image from the canvas
    }

    return (s: State) => {
        // Add birb to the main grid canvas
        const birdImg = createSvgElement(svg.namespaceURI, "image", {
            href: "assets/birb.png",
            x: `${Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2}`,
            y: `${s.birbPosition}`,
            width: `${Birb.WIDTH}`,
            height: `${Birb.HEIGHT}`,
        });
        svg.appendChild(birdImg);

        // Draw a static pipe as a demonstration
        const pipeGapY = s.gapY * Viewport.CANVAS_HEIGHT; // vertical center of the gap
        const pipeGapHeight = s.gapHeight * Viewport.CANVAS_HEIGHT;

        // Top pipe
        const pipeTop = createSvgElement(svg.namespaceURI, "rect", {
            x: "150",
            y: "0",
            width: `${Constants.PIPE_WIDTH}`,
            height: `${(pipeGapY - pipeGapHeight) / 2}`,
            fill: "green",
        });

        // Bottom pipe
        const pipeBottom = createSvgElement(svg.namespaceURI, "rect", {
            x: "150",
            y: `${pipeGapY + pipeGapHeight / 2}`,
            width: `${Constants.PIPE_WIDTH}`,
            height: `${Viewport.CANVAS_HEIGHT - (s.gapY + s.gapHeight / 2)}`,
            fill: "green",
        });

        // svg.appendChild(pipeTop);
        // svg.appendChild(pipeBottom);
    };
};

export const state$ = (csvContents: string): Observable<State> => {
    /** User input */

    const pipeProperties = csvContents
        .split("\n")
        .slice(1)
        .map(e => {
            const rows = e.split(",");
            return {
                gapY: Number(rows[0]),
                gapHeight: Number(rows[1]),
                time: Number(rows[2]),
            };
        });

    const key$ = fromEvent<KeyboardEvent>(document, "keypress");
    const fromKey = (keyCode: Key) =>
        key$.pipe(filter(e => e.code === keyCode));

    const flap$: Observable<(s: State) => State> = fromKey("Space").pipe(
        map(_ => (s: State) => ({
            ...s,
            birbVelocity: -10,
        })),
    );

    /** Determines the rate of time steps */
    const tick$: Observable<(s: State) => State> = interval(
        Constants.TICK_RATE_MS,
    ).pipe(
        map(_ => (s: State) => {
            const gravity = 1;
            const newBirbvelocity = s.birbVelocity + gravity;
            const newBirbposition = s.birbPosition + newBirbvelocity;

            if (newBirbposition <= 0 || newBirbposition <= s.gapHeight) {
                return {
                    ...s,
                    birbPosition: 0,
                    birbVelocity: newBirbvelocity,
                };
            }

            if (newBirbposition >= Viewport.CANVAS_HEIGHT - Birb.HEIGHT) {
                return {
                    ...s,
                    birbPosition: Viewport.CANVAS_HEIGHT - Birb.HEIGHT,
                    birbVelocity: newBirbvelocity,
                };
            }

            return {
                ...s,
                birbPosition: newBirbposition,
                birbVelocity: newBirbvelocity,
            };
        }),
    );

    return merge(flap$, tick$).pipe(
        scan((s, reducer) => reducer(s), initialState),
    );
};

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    const csvUrl = `${baseUrl}/assets/map.csv`;

    // Get the file from URL
    const csv$ = fromFetch(csvUrl).pipe(
        switchMap(response => {
            if (response.ok) {
                return response.text();
            } else {
                throw new Error(`Fetch error: ${response.status}`);
            }
        }),
        catchError(err => {
            console.error("Error fetching the CSV file:", err);
            throw err;
        }),
    );

    // Observable: wait for first user click
    const click$ = fromEvent(document.body, "mousedown").pipe(take(1));

    csv$.pipe(
        switchMap(contents =>
            // On click - start the game
            click$.pipe(switchMap(() => state$(contents))),
        ),
    ).subscribe(s => render()(s));
}
