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

import { constants } from "buffer";
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
    PIPE_TRAVEL_MS: 3000,
} as const;

// User input

type Key = "Space";

// State processing
type Pipe = Readonly<{
    gapY: number;
    gapHeight: number;
    time: number;
    age: number;
    xpos: number;
}>;

type State = Readonly<{
    gameEnd: boolean;
    birbPosition: number;
    birbVelocity: number;
    birbLives: number;
    timeStart: number;
    elapsedTime: number;
    pipeRead?: Pipe[];
    pipeRendering?: Pipe[];
}>;

const initialState: State = {
    gameEnd: false,
    birbPosition: 200,
    birbVelocity: 0,
    birbLives: 3,
    timeStart: performance.now(),
    elapsedTime: 0,
};

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

    const removePipe = () => {
        const allPipesRendering = svg.querySelectorAll("rect");
        const pipesToRemove = [
            allPipesRendering.item(0),
            allPipesRendering.item(1),
        ];
        pipesToRemove.forEach(p => svg.removeChild(p));
    };
    /**
     * Renders the current state to the canvas.
     *
     * In MVC terms, this updates the View using the Model.
     *
     * @param s Current state
     */

    return (s: State) => {
        const prev = svg.querySelector("image");
        if (prev) svg.removeChild(prev);

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
        const prevPipes = svg.querySelectorAll("rect");
        if (prevPipes) prevPipes.forEach(n => n.remove());

        const pipesOnCanvas = s.pipeRendering;

        if (pipesOnCanvas) pipesOnCanvas.forEach(createWholePipe);

        function createWholePipe(p: Pipe): void {
            const pipeConvertedGap = p.gapY * Viewport.CANVAS_HEIGHT;
            const pipeConvertedHeight = p.gapHeight * Viewport.CANVAS_HEIGHT;

            const topH = pipeConvertedGap - pipeConvertedHeight / 2;
            const bottomY = pipeConvertedGap + pipeConvertedHeight / 2;
            const bottomH = Viewport.CANVAS_HEIGHT - bottomY;

            // Top pipe
            const pipeTop = createSvgElement(svg.namespaceURI, "rect", {
                x: `${p.xpos}`,
                y: "0",
                width: `${Constants.PIPE_WIDTH}`,
                height: `${topH}`,
                fill: "green",
            });

            // Bottom pipe
            const pipeBottom = createSvgElement(svg.namespaceURI, "rect", {
                x: `${p.xpos}`,
                y: `${bottomY}`,
                width: `${Constants.PIPE_WIDTH}`,
                height: `${bottomH}`,
                fill: "green",
            });

            svg.appendChild(pipeTop);
            svg.appendChild(pipeBottom);
        }
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
                time: Number(rows[2]) * 1000,
                age: 0,
                xpos: Viewport.CANVAS_WIDTH,
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
            const gravity = 0.75;
            const newBirbVelocity = s.birbVelocity + gravity;
            const newBirbPositionUnbound = s.birbPosition + newBirbVelocity;
            const floor = Viewport.CANVAS_HEIGHT - Birb.HEIGHT;

            const newBirbPosition =
                newBirbPositionUnbound <= 0
                    ? 0
                    : newBirbPositionUnbound >= floor
                      ? floor
                      : newBirbPositionUnbound;

            const pipeQueue: Pipe[] = pipeProperties; //read the csv content at the start, otherwise continue from previous state
            const currentTime = performance.now() - s.timeStart;

            const travel = Constants.PIPE_TRAVEL_MS; // ms
            const distance = Viewport.CANVAS_WIDTH + Constants.PIPE_WIDTH; // px

            const nextPipe = pipeQueue
                .filter(p => p.time <= currentTime)
                .map(p => {
                    const age = currentTime - p.time; // can be < 0 before spawn, so it will not just spawn at s.time >= p.time
                    const rawProgress = age / travel; // progress represented as ratio
                    const clampedProgress =
                        rawProgress <= 0
                            ? 0
                            : rawProgress >= 1
                              ? 1
                              : rawProgress; // clamp to progress to [0,1]
                    const xpos =
                        Viewport.CANVAS_WIDTH - distance * clampedProgress; // right → left past edge
                    return { ...p, age, xpos };
                })
                .filter(p => p.age >= 0 && p.age <= travel); // only pipes on screen

            return {
                ...s,
                birbPosition: newBirbPosition,
                birbVelocity: newBirbVelocity,
                elapsedTime: currentTime,
                pipeRead: pipeQueue,
                pipeRendering: nextPipe,
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
