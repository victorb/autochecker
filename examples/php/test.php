<?php
class Money
{
  private $amount;

  public function __construct($amount)
  {
    $this->amount = $amount;
  }

  public function getAmount()
  {
    return $this->amount;
  }

  public function negate()
  {
    return new Money(-1 * $this->amount);
  }
}

class MoneyTest extends PHPUnit_Framework_TestCase
{
  public function testCanBeNegated()
  {
    // Arrange
    $a = new Money(1);

    // Act
    $b = $a->negate();

    // Assert
    $this->assertEquals(-1, $b->getAmount());
  }
}
