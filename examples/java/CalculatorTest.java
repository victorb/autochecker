import static org.junit.Assert.assertEquals;
import org.junit.Test;
// TODO Make to fail on different version

public class CalculatorTest {
  @Test
  public void evaluatesExpression() {
    Calculator calculator = new Calculator();
    int sum = calculator.evaluate("1+2+3");
    assertEquals(9, sum);
  }
}
