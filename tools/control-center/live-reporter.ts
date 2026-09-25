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
  onBegin(_config: unknown, suite: Suite): void {
    console.log(`Running ${suite.allTests().length} test(s)`);
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
    const icon = result.status === 'passed' ? 'OK' : 'FAIL';
    console.log(`[${stamp()}] ${icon} ${test.title} (${(result.duration / 1000).toFixed(1)}s)`);
  }

  onEnd(result: { status: string }): void {
    console.log(`\n${result.status === 'passed' ? 'PASSED' : 'FAILED'}`);
  }
}

export default LiveReporter;
