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
    startWith,
    takeWhile,
    tap,
    finalize,
    EMPTY,
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
    GRAVITY: 0.6,
} as const;

const Constants = {
    PIPE_WIDTH: 50,
    TICK_RATE_MS: 16, // Might need to change this!
    PIPE_TRAVEL_MS: 3000,
} as const;

const Bounce = {
    SPREAD: 4,
    MEAN: 8, //mean to spread from
    SEED: 1234,
};

// User input

type Key = "Space" | "KeyR";

// State processing
type Pipe = Readonly<{
    gapY: number;
    gapHeight: number;
    time: number;
    age: number;
    xpos: number;
    prevXpos: number;
    birdPassing: boolean;
    prevPassing: boolean;
    passed: boolean;
    gapTop: number;
    gapBottom: number;
}>;

type State = Readonly<{
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
    invinciblePipeTime?: number;
    ghostBirbPos?: number;
}>;

const initialState: State = {
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
        const gameEnd = s.gameOver || s.score === 20;

        const prev = svg.querySelectorAll("image"); //remove sprites from previous state
        prev.forEach(n => n.remove());
        const prevPipes = svg.querySelectorAll("rect");
        prevPipes.forEach(n => n.remove());

        //const prev = svg.querySelector("image");
        //if (prev) svg.removeChild(prev);

        // Draw a static pipe as a demonstration
        //const prevPipes = svg.querySelectorAll("rect");
        //if (prevPipes) prevPipes.forEach(n => n.remove());

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

        if (s.ghostBirbPos !== undefined) {
            const ghostImg = createSvgElement(svg.namespaceURI, "image", {
                href: "assets/birb.png", // or a greyed asset if you have one
                x: `${Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2}`,
                y: `${s.ghostBirbPos}`,
                width: `${Birb.WIDTH}`,
                height: `${Birb.HEIGHT}`,
                opacity: "0.3", // same properties as birb but decrease opacity
            });
            svg.appendChild(ghostImg);
        }

        // Add birb to the main grid canvas
        const birdImg = createSvgElement(svg.namespaceURI, "image", {
            href: "assets/birb.png",
            x: `${Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2}`,
            y: `${s.birbPosition}`,
            width: `${Birb.WIDTH}`,
            height: `${Birb.HEIGHT}`,
        });
        svg.appendChild(birdImg);

        scoreText.textContent = String(s.score);
        livesText.textContent = String(s.birbLives);

        const msgUpdate = (msg: SVGTextElement, msgText: string) => {
            const line1 = document.createElementNS(svg.namespaceURI, "tspan");
            line1.setAttribute("x", msg.getAttribute("x")!); // align with parent <text> x
            line1.setAttribute("dy", "0"); // first line, no vertical offset
            line1.textContent = msgText;

            const line2 = document.createElementNS(svg.namespaceURI, "tspan");
            line2.setAttribute("x", msg.getAttribute("x")!);
            line2.setAttribute("dy", "1.2em"); // 1.2em below the first line
            line2.textContent = "Press R to Play Again";

            msg.appendChild(line1);
            msg.appendChild(line2);
        };

        if (gameEnd) {
            show(gameOver);
            const msg = gameOver.querySelector("text");

            if (msg) {
                msg.textContent = ""; //clear previous msg
                if (s.score === 20) msgUpdate(msg, "You Won!");
                else msgUpdate(msg, "Game Over!");
            }
        } else hide(gameOver);
    };
};

export const state$ = (csvContents: string): Observable<State> => {
    /** User input */
    const prevPathRef: {
        //reference to previous birb flap path
        value: ReadonlyArray<{ t: number; y: number }> | undefined;
    } = { value: undefined };

    const makeGhostReducers = (
        path: ReadonlyArray<{ t: number; y: number }>, //t is the elapsed time since time started, y is y position of bird
    ) => {
        if (!path.length) return EMPTY as Observable<(s: State) => State>; //if no recorded path

        const totalTimeTravelled = path[path.length - 1].t; //total time the ghost birb was travelling

        const lastIdxLE = (t: number): number =>
            path.reduce((best, pt, i) => (pt.t <= t ? i : best), 0);

        return interval(Constants.TICK_RATE_MS).pipe(
            // emits 0, 1 , 2 ,...
            map(i => i * Constants.TICK_RATE_MS), // convert to 0, 16, 32, ... (time in ms)
            takeWhile(t => t <= totalTimeTravelled, true), // emit until the last recorded time of ghost birb, but add one extra tick
            map(t => {
                const inside = t <= totalTimeTravelled;
                const y = inside ? path[lastIdxLE(t)].y : undefined;
                return (s: State): State =>
                    inside
                        ? { ...s, ghostBirbPos: y as number }
                        : { ...s, ghostBirbPos: undefined };
            }),
        );
    };

    const pipeProperties: Pipe[] = csvContents // read csv file for pipes, and map them into an array as Pipe objects
        .split("\n")
        .slice(1)
        .map(e => {
            const rows = e.split(",");
            const gapYf = Number(rows[0]); // fraction
            const gapHf = Number(rows[1]); // fraction
            const gy = gapYf * Viewport.CANVAS_HEIGHT; // convert fraction to fit the canvas
            const gh = gapHf * Viewport.CANVAS_HEIGHT;
            const gapTop = gy - gh / 2;
            const gapBottom = gy + gh / 2 - Birb.HEIGHT;
            const startX = Viewport.CANVAS_WIDTH;
            return {
                gapY: Number(rows[0]),
                gapHeight: Number(rows[1]),
                time: Number(rows[2]) * 1000,
                age: 0,
                xpos: Viewport.CANVAS_WIDTH,
                prevXpos: startX,
                birdPassing: false,
                prevPassing: false,
                passed: false,
                gapTop,
                gapBottom,
            };
        });

    const key$ = fromEvent<KeyboardEvent>(document, "keypress"); //stream of keypress observables
    const fromKey = (keyCode: Key) =>
        key$.pipe(filter(e => e.code === keyCode));

    const flap$: Observable<(s: State) => State> = fromKey("Space").pipe(
        // change birbVelocity (gravity logic) if a space keypress is registered
        map(
            _ => (s: State) =>
                s.gameOver || s.score === 20
                    ? s
                    : {
                          ...s,
                          birbVelocity: -7,
                      },
        ),
    );

    /** Determines the rate of time steps */
    const tick$: Observable<(s: State) => State> = interval(
        //updates state every tick
        Constants.TICK_RATE_MS,
    ).pipe(
        map(_ => (s: State) => {
            if (s.gameOver || s.score === 20) return s; //stop state update if game end conditions are met

            // update the properties regarding bird in state
            const updatedBirbVelocity = s.birbVelocity + Birb.GRAVITY;
            const newBirbPositionUnbound = s.birbPosition + updatedBirbVelocity;
            const floor = Viewport.CANVAS_HEIGHT - Birb.HEIGHT;

            const pipeQueue: Pipe[] = s.pipeRead ?? pipeProperties; //read the csv content at the start, otherwise continue from previous state
            const currentTime = performance.now() - s.timeStart;

            const travel = Constants.PIPE_TRAVEL_MS; // ms
            const distance = Viewport.CANVAS_WIDTH + Constants.PIPE_WIDTH; // px
            const BIRB_X = Viewport.CANVAS_WIDTH * 0.3 - Birb.WIDTH / 2;
            const BIRB_REAR = BIRB_X + Birb.WIDTH;

            //all helper functions listed here:
            // clamp a ratio into [0,1]
            const clamp01 = (x: number): number =>
                x <= 0 ? 0 : x >= 1 ? 1 : x;

            // pipe xpos at given age
            const pipeXposAtAge = (age: number): number => {
                const prog = clamp01(age / travel);
                return Viewport.CANVAS_WIDTH - distance * prog;
            };

            // Clamp a y into the pipe’s gap
            const clampToPipeGap = (p: Pipe, y: number): number =>
                y <= p.gapTop ? p.gapTop : y >= p.gapBottom ? p.gapBottom : y;
            // birb outside the gap vertically?
            const outsideGapY = (p: Pipe, y: number): boolean =>
                y <= p.gapTop || y >= p.gapBottom;
            // which side was hit? true if  top side
            const hitTopSide = (p: Pipe, y: number): boolean => y <= p.gapTop;

            const pipeQueueUpdated = pipeQueue.map(p => {
                //we are updating the pipes' property in the queue
                const age = currentTime - p.time; // can be < 0 before spawn, so it will not just spawn at s.time >= p.time
                const newX = pipeXposAtAge(age); // current frame xpos
                const prevXpos = p.xpos; // remember last frame's xpos
                const xpos = newX; //update xpos to the latest calculated xpos
                const prevPassing = p.birdPassing; //take the previous birdPassing truth value
                const birdPassing =
                    xpos <= BIRB_REAR && xpos + Constants.PIPE_WIDTH >= BIRB_X
                        ? true
                        : false;
                const passed =
                    BIRB_X > xpos + Constants.PIPE_WIDTH ? true : p.passed;
                return {
                    ...p,
                    age,
                    prevXpos,
                    xpos,
                    prevPassing,
                    passed,
                    birdPassing,
                };
            });

            const pipeQueuePass = pipeQueueUpdated // pipeQueuePass is used to store all pipes that has been rendered, not considering if it is currently rendering
                .filter(p => p.time <= currentTime);

            const nextPipe = pipeQueuePass.filter(
                //Array of all pipes currently rendering
                p => p.age >= 0 && p.age <= travel,
            ); // only pipes on screen

            //get the pipe that the bird is currently passing through
            const currentPipePassing = pipeQueuePass.find(
                p => p.birdPassing === true,
            );

            // clamp birb position into canvas
            const updatedBirbPosition =
                newBirbPositionUnbound <= 0
                    ? 0
                    : newBirbPositionUnbound >= floor
                      ? floor
                      : newBirbPositionUnbound;

            //check if birb hit canvas this frame
            const hitCanvas =
                updatedBirbPosition === floor
                    ? true
                    : updatedBirbPosition === 0
                      ? true
                      : false;

            const overlapping = currentPipePassing;

            // first contact with this pipe this frame, we use the time in the csv as an id
            const firstHitThisPipe = !!(
                overlapping && // ensure the bird is currently overlapping with the pipe's x position
                outsideGapY(overlapping, updatedBirbPosition) && //bird is not within the gap
                s.invinciblePipeTime !== overlapping.time //check if we hit this pipe before
            );

            // still overlapping the same pierced pipe from a previous frame?
            const keepPiercing = !!(
                overlapping &&
                s.invinciblePipeTime !== undefined && //so that bird is not invincible in the case it hasn't hit any pipe yet
                s.invinciblePipeTime === overlapping.time //keep piercing if we already hit this pipe before
            );

            const isSideEntry =
                // we always use !! if the variables could be null to get false for null
                !!(overlapping && firstHitThisPipe) && //is this the first time hitting
                !overlapping.prevPassing && //if the previous state of the pipe's birdPassing property is false
                overlapping.birdPassing; // if current state is true, side entry defined by the moment birdPassing changes from false to trues

            const shouldClamp = !!(
                //should we clamp? No if the bird did not hit the side of the pipe
                (firstHitThisPipe && overlapping && !isSideEntry)
            );

            const newBirbPosition = shouldClamp //update the bird position again accordingly to pipe's hitbox logic
                ? clampToPipeGap(overlapping, updatedBirbPosition)
                : updatedBirbPosition;

            // check if it hit top or bottom, true if hit top
            const hitTopSidePipe = !!(
                firstHitThisPipe &&
                overlapping &&
                hitTopSide(overlapping, updatedBirbPosition)
            );

            const hitCanvasTop = updatedBirbPosition === 0;

            const collideFrame: boolean = firstHitThisPipe || hitCanvas; //hit anything this frame?

            // randomizer, seed is updated so we can randomize in future states
            const seed1 = collideFrame ? RNG.hash(s.rngSeed) : s.rngSeed;
            const r = collideFrame ? RNG.scale(seed1) : 0; // [-1,1]
            const bounce = collideFrame ? Bounce.MEAN + Bounce.SPREAD * r : 0;

            //birb velocity is updated to the calculated value if no collide, otherwise updated to the randomized velocity
            const newBirbVelocity = !collideFrame
                ? updatedBirbVelocity
                : hitCanvasTop || hitTopSidePipe
                  ? bounce
                  : -bounce;

            //check if we need to reduce live
            const newBirbLives =
                firstHitThisPipe || hitCanvas
                    ? s.birbLives - 1 <= 0
                        ? 0
                        : s.birbLives - 1
                    : s.birbLives;

            //update pipe ID checker (according to csv file's time property for pipes)
            const invinciblePipeTime2 =
                firstHitThisPipe && overlapping
                    ? overlapping.time
                    : keepPiercing
                      ? s.invinciblePipeTime
                      : undefined;

            // update the score according to how many pipes passed
            const scoreUpdate = pipeQueuePass.filter(
                p => p.passed === true,
            ).length;

            const newGameOver: boolean = newBirbLives === 0 ? true : false; //false if game is still ongoing, true if lost

            const rngSeed2 = collideFrame ? seed1 : s.rngSeed; //update seed

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
                invinciblePipeTime: invinciblePipeTime2,
            };
        }),
    );

    const restart$ = fromKey("KeyR"); //press R to restart game

    return restart$.pipe(
        startWith(null), // start on load, so at the start before first R key it acts as the first signal to start game
        switchMap(() => {
            const ghost$ =
                prevPathRef.value && prevPathRef.value.length
                    ? makeGhostReducers(prevPathRef.value)
                    : EMPTY;

            const reducers$: Observable<(s: State) => State> = merge(
                flap$,
                tick$,
                ghost$,
            );

            const currentPath: ReadonlyArray<{ t: number; y: number }> = [];

            const runState$ = reducers$.pipe(
                //observables that return a function that updates state
                scan((state, reducerFn) => reducerFn(state), {
                    ...initialState,
                    timeStart: performance.now(), // timeStart has to be recalculated or the new initial state just continues time progression
                }),
                takeWhile(s => !(s.gameOver || s.score === 20), true),
                // sample position vs elapsed time
                // tap doesn't change the stream, just observes it then applies the observable's values to the currentPath array
                tap(s =>
                    (currentPath as { t: number; y: number }[]).push({
                        t: s.elapsedTime,
                        y: s.birbPosition,
                    }),
                ),
                // save for the next run
                finalize(() => {
                    if (currentPath.length) {
                        prevPathRef.value = currentPath; //change the reference to previous path's value property to the current path
                    }
                }),
            );

            return runState$;
        }),
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

    const draw = render(); //save instance

    csv$.pipe(
        switchMap(contents =>
            // On click - start the game
            click$.pipe(switchMap(() => state$(contents))),
        ),
    ).subscribe(s => draw(s));
}
