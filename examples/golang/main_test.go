package main

import (
	"testing"
)

func sum(a, b int) int {
	return a + b
}

func TestSum(t *testing.T) {
	if want, got := 5, sum(2, 3); got != want {
		t.Fatalf("Expecting %d, but got %d\n", want, got)
	}
}
