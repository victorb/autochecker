FROM java:8-jdk-alpine

WORKDIR /usr/src/app

COPY Calculator.java .
COPY CalculatorTest.java .

RUN wget https://github.com/junit-team/junit4/releases/download/r4.12/junit-4.12.jar
RUN wget search.maven.org/remotecontent?filepath=org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar

RUN javac Calculator.java
RUN javac -cp .:junit-4.12.jar CalculatorTest.java

RUN java -cp .:junit-4.12.jar:hamcrest-core-1.3.jar org.junit.runner.JUnitCore CalculatorTest
