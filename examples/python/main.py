import unittest

def fun(x):
  print("Called fun")
  return x + 1

class MyTest(unittest.TestCase):
  def test(self):
    self.assertEqual(fun(3), 4)

unittest.main()
