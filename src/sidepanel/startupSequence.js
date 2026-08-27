/**
 * The panel's startup sequence, as a shape rather than a straight line of awaits.
 *
 * This exists to be driveable. The steps used to run inline in `onMounted`, which
 * made their ordering unobservable: claims about it could only be checked by
 * watching a real panel start, and "watched it once" is not a check that can fail
 * later. Passing the steps in means a test can hang one, reject another, and
 * assert what the rest did.
 *
 * Three roles, because the steps genuinely differ in how startup depends on them:
 *
 *   prerequisite — the one step everything else needs (storage must be up before
 *                  anything reads it). Its rejection propagates: there is nothing
 *                  meaningful to continue with.
 *   dependents   — need the prerequisite, but not each other. Run concurrently.
 *                  One rejecting does not prevent the others; all rejections are
 *                  returned so the caller can decide what the user sees.
 *   background   — started and deliberately never awaited. A step that never
 *                  settles must not hold up completion.
 *
 * A step is `{ name, run }`; `run` receives the prerequisite's resolved value.
 *
 * Why dependent failures are returned but background failures are not: returning
 * them lets the caller act on the aggregate (one message rather than one per
 * step). A background step has no aggregate to return into — by the time it
 * fails, the sequence has already finished — so it reports through `onStepError`.
 */
export async function runStartupSequence({
  prerequisite,
  dependents = [],
  background = [],
  onStepError = () => {}
}) {
  const value = await prerequisite.run();

  for (const step of background) {
    // Detached on purpose. Wrapped in Promise.resolve().then so that a step which
    // throws synchronously is caught here too, rather than escaping past the loop
    // and taking down the sequence a background step is defined not to affect.
    Promise.resolve()
      .then(() => step.run(value))
      .catch((error) => { onStepError(step.name, error); });
  }

  const settled = await Promise.allSettled(dependents.map((step) => step.run(value)));

  const failures = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === 'rejected') {
      const failure = { name: dependents[index].name, error: outcome.reason };
      failures.push(failure);
      onStepError(failure.name, failure.error);
    }
  });

  return { value, failures };
}
