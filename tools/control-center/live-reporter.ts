import type { Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

/**
 * Minimal live reporter for the Control Center console: prints a timestamped
 * line per test step so QA can watch progress without the Playwright UI.
 * Only titles/timings are emitted (no headers, bodies or credentials).
 */
function stamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

class LiveReporter implements Reporter {
  private counts = { passed: 0, failed: 0, skipped: 0 };

  onBegin(_config: unknown, suite: Suite): void {
    console.log(`Running ${suite.allTests().length} test(s)`);
  }

  // Forward worker stdout/stderr (e.g. test console output) to the runner.
  onStdOut(chunk: string | Buffer): void {
    process.stdout.write(chunk.toString());
  }

  onStdErr(chunk: string | Buffer): void {
    process.stderr.write(chunk.toString());
  }

  onTestBegin(test: TestCase): void {
    console.log(`\n> ${test.title}`);
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category === 'test.step') {
      console.log(`[${stamp()}] ${step.title}`);
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Expected outcomes (e.g. test.fail) count as passed; Playwright exit code
    // remains the ultimate source of truth.
    if (result.status === 'skipped') {
      this.counts.skipped += 1;
    } else if (result.status === test.expectedStatus) {
      this.counts.passed += 1;
    } else {
      this.counts.failed += 1;
    }
    const icon = result.status === 'passed' || result.status === test.expectedStatus ? 'OK' : 'FAIL';
    console.log(`[${stamp()}] ${icon} ${test.title} (${(result.duration / 1000).toFixed(1)}s)`);
  }

  onEnd(result: { status: string }): void {
    console.log(`\n${result.status === 'passed' ? 'PASSED' : 'FAILED'}`);
    console.log(
      `CONTROL_CENTER_EVENT ${JSON.stringify({ type: 'summary', ...this.counts })}`,
    );
  }
}

export default LiveReporter;
