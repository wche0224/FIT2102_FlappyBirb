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
    GRAVITY: 0.75,
} as const;

const Constants = {
    PIPE_WIDTH: 50,
    TICK_RATE_MS: 16, // Might need to change this!
    PIPE_TRAVEL_MS: 3000,
} as const;

const Bounce = {
    SPREAD: 3,
    MEAN: 5, //mean to spread from
    SEED: 1234,
};

// User input

type Key = "Space";

// State processing
type Pipe = Readonly<{
    gapY: number;
    gapHeight: number;
    time: number;
    age: number;
    xpos: number;
    birdPassing: boolean;
    passed: boolean;
}>;

type State = Readonly<{
    gameEnd: boolean;
    birbPosition: number;
    birbVelocity: number;
    birbLives: number;
    timeStart: number;
    elapsedTime: number;
    score: number;
    gameOver: boolean;
    pipeRead?: Pipe[];
    pipeRendering?: Pipe[];
    pipeHistory?: Pipe[];
    pipePassing?: Pipe;
    rngSeed: number;
}>;

const initialState: State = {
    gameEnd: false,
    birbPosition: 200,
    birbVelocity: 0,
    birbLives: 3,
    timeStart: performance.now(),
    elapsedTime: 0,
    score: 0,
    gameOver: false,
    rngSeed: Bounce.SEED,
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

abstract class RNG {
    private static m = 0x80000000; // 2^31
    private static a = 1103515245;
    private static c = 12345;

    public static hash = (seed: number): number =>
        (RNG.a * seed + RNG.c) % RNG.m;

    public static scale = (hash: number): number =>
        (2 * hash) / (RNG.m - 1) - 1; // in [-1, 1]
}

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

    return (s: State) => {
        if (s.gameOver) gameOver.setAttribute("visibility", "visible");

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

        scoreText.textContent = String(s.score);
        livesText.textContent = String(s.birbLives);
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
                birdPassing: false,
                passed: false,
            };
        });

    const key$ = fromEvent<KeyboardEvent>(document, "keypress");
    const fromKey = (keyCode: Key) =>
        key$.pipe(filter(e => e.code === keyCode));

    const flap$: Observable<(s: State) => State> = fromKey("Space").pipe(
        map(_ => (s: State) => ({
            ...s,
            birbVelocity: -9,
        })),
    );

    /** Determines the rate of time steps */
    const tick$: Observable<(s: State) => State> = interval(
        Constants.TICK_RATE_MS,
    ).pipe(
        map(_ => (s: State) => {
            const updatedBirbVelocity = s.birbVelocity + Birb.GRAVITY;
            const newBirbPositionUnbound = s.birbPosition + updatedBirbVelocity;
            const floor = Viewport.CANVAS_HEIGHT - Birb.HEIGHT;

            const pipeQueue: Pipe[] = s.pipeRead ?? pipeProperties; //read the csv content at the start, otherwise continue from previous state
            const currentTime = performance.now() - s.timeStart;

            const travel = Constants.PIPE_TRAVEL_MS; // ms
            const distance = Viewport.CANVAS_WIDTH + Constants.PIPE_WIDTH; // px
            const BIRB_X = Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2;
            const BIRB_REAR = BIRB_X + Birb.WIDTH;

            const pipeQueueUpdated = pipeQueue.map(p => {
                //we are updating the pipes' property in the queue
                const age = currentTime - p.time; // can be < 0 before spawn, so it will not just spawn at s.time >= p.time
                const rawProgress = age / travel; // progress represented as ratio
                const clampedProgress =
                    rawProgress <= 0 ? 0 : rawProgress >= 1 ? 1 : rawProgress; // clamp to progress to [0,1]
                const xpos = Viewport.CANVAS_WIDTH - distance * clampedProgress; // right → left past edge
                const passed =
                    BIRB_X - xpos + Constants.PIPE_WIDTH >= 0 ? true : p.passed;
                const birdPassing =
                    xpos <= BIRB_REAR && xpos + Constants.PIPE_WIDTH >= BIRB_X
                        ? true
                        : false;
                return { ...p, age, xpos, passed, birdPassing };
            });

            const pipeQueuePass = pipeQueueUpdated // pipeQueuePass is used to store all pipes that has been rendered, not considering if it is currently rendering
                .filter(p => p.time <= currentTime);

            const nextPipe = pipeQueuePass.filter(
                //Array of all pipes currently rendering
                p => p.age >= 0 && p.age <= travel,
            ); // only pipes on screen

            const currentPipePassing = pipeQueuePass.find(
                p => p.birdPassing === true,
            );

            const scoreUpdate = pipeQueuePass.filter(
                p => p.passed === true,
            ).length;

            const velocityAfterBounce = () => {
                const hashedValue = RNG.hash(s.rngSeed);
                const scaledValue = RNG.scale(hashedValue);
                const bounceDownGravity =
                    Bounce.MEAN + Bounce.SPREAD * scaledValue;
                const bounceUpGravity =
                    -Bounce.MEAN + Bounce.SPREAD * scaledValue;
                return {
                    bounceDownGravity,
                    bounceUpGravity,
                    hashedValue,
                };
            };

            const updatedBirbPosition =
                newBirbPositionUnbound <= 0
                    ? 0
                    : newBirbPositionUnbound >= floor
                      ? floor
                      : newBirbPositionUnbound;

            const hitCanvas =
                updatedBirbPosition === floor
                    ? true
                    : updatedBirbPosition === 0
                      ? true
                      : false;

            const calcGap = (p: Pipe) => {
                const pipeConvertedGap = p.gapY * Viewport.CANVAS_HEIGHT;
                const pipeConvertedHeight =
                    p.gapHeight * Viewport.CANVAS_HEIGHT;
                const curPipeGapTop =
                    pipeConvertedGap - pipeConvertedHeight / 2;
                const curPipeGapBottom =
                    pipeConvertedGap + pipeConvertedHeight / 2 - Birb.HEIGHT;
                return { curPipeGapTop, curPipeGapBottom };
            };

            const hitPipe =
                currentPipePassing != undefined
                    ? updatedBirbPosition <=
                          calcGap(currentPipePassing).curPipeGapTop ||
                      updatedBirbPosition >=
                          calcGap(currentPipePassing).curPipeGapBottom
                    : false;

            const clampToGap = (p: Pipe, y: number) => {
                const g = calcGap(p);
                return y <= g.curPipeGapTop
                    ? g.curPipeGapTop
                    : y >= g.curPipeGapBottom
                      ? g.curPipeGapBottom
                      : y;
            };

            const newBirbPosition =
                hitPipe && currentPipePassing
                    ? clampToGap(currentPipePassing, updatedBirbPosition)
                    : updatedBirbPosition;

            const newBirbVelocity =
                newBirbPosition === updatedBirbPosition //means no pipe collision
                    ? updatedBirbPosition === newBirbPositionUnbound //means no canvas collision
                        ? updatedBirbVelocity
                        : updatedBirbPosition === 0
                          ? velocityAfterBounce().bounceDownGravity
                          : velocityAfterBounce().bounceUpGravity
                    : currentPipePassing
                      ? newBirbPosition ===
                        calcGap(currentPipePassing).curPipeGapTop
                          ? velocityAfterBounce().bounceDownGravity
                          : velocityAfterBounce().bounceUpGravity
                      : updatedBirbVelocity;

            const newBirbLives =
                hitCanvas || hitPipe
                    ? s.birbLives - 1 <= 0
                        ? 0
                        : s.birbLives - 1
                    : s.birbLives;

            const newGameOver: boolean = newBirbLives === 0 ? true : false; //false if game is still ongoing, true if lost

            const rngSeed2 =
                hitCanvas || hitPipe ? RNG.hash(s.rngSeed) : s.rngSeed;

            return {
                ...s,
                birbPosition: newBirbPosition,
                birbVelocity: newBirbVelocity,
                birbLives: newBirbLives,
                elapsedTime: currentTime,
                score: scoreUpdate,
                gameOver: newGameOver,
                pipeRead: pipeQueueUpdated,
                pipeRendering: nextPipe,
                rngSeed: rngSeed2,
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
