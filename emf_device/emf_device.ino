//
// Created by Florian Kuenzig on 16.06.2023.
//
// this program reads the electric grids main frequency from a digital signal.
#include <Arduino.h>
#include <Wire.h>
#include <rtc_methods.h>
// Interrupt flags
volatile boolean calculateFrequency = false;  // Flag to indicate that the time interrupt has been triggered and the next peak after the last time point has been reached. No we want to calculate the frequency of the past second.
volatile boolean timeInterrupt = true;        // Flag to indicate that the 1 Hz Interrupt has been triggered.

const int signalPin = 2;      // The digital pin the transistor is connected to.
const int timeSignalPin = 3;  // The digital pin the clock is connected to.

// Variables for the frequency calculation
int count = 0;                        // Counter for the peaks of the current 1 second time window.
int countBefore = 0;                  // Counter from the previous 1 second time window.
float missedFractionalPeakStart = 0;  // The missed fractional peak between the start of the current time window and the time interrupt.
float missedFractionalPeakEnd = 0;    // The missed fractional peak between the end of the last time window and the time interrupt.
float currentFrequency = 0;           // Current frequency in Hz.

// Variables for the time calculation
volatile unsigned long microsInterruptBefore = 0;  // Time point of the second to last signal Interrupt im µs.
volatile unsigned long microsTimeInterrupt = 0;    // Time in microseconds when the signal interrupt has been triggered.
volatile unsigned long unixTime = 0;               // Current POSIX - Time in one second resolution.
unsigned long microsPeakBefore = 0;                // Time in microseconds when the second to last signal interrupt occurred.
unsigned long microsPeakCurrent = 0;               // Time in microseconds when the current (last) signal interrupt occurred.
int RTC = 3231;                                    // Value 3231 = DS3231 RTC, 1307 = DS1307 RTC, 0 = GPS

/**
 * @brief Arduino setup function that is called once at the beginning of the program.
 */
void setup() {
    // Configure PIN for Frequency reception
    pinMode(signalPin, INPUT);             // Input for the frequency signal from the grid.
    pinMode(timeSignalPin, INPUT_PULLUP);  // Input for the 1 Hz signal from the RTC.

    // Start communication ports
    Wire.begin();          // Start I2C communication.
    Serial.begin(115200);  // Start the serial port at 115200 baud.

    // Start RTC clock 1Hz Signal
    initSquareSignal(RTC);  // Initialize the RTC clock with 1 Hz square signal.

    // Attach Time Interrupt
    attachInterrupt(digitalPinToInterrupt(timeSignalPin), timeInterruptISR, RISING);  // Attach Interrupt Routine for the 1 Hz signal from the RTC.
    attachInterrupt(digitalPinToInterrupt(signalPin), handlePeakEventISR, RISING);    // Attach Interrupt Routine for the frequency signal from the grid.

    unixTime = getUnixTimestamp(RTC);  // Get the current POSIX time in seconds (From the RTC).
}

/**
 * @brief Arduino loop function that is called repeatedly in an endless loop.
 */
void loop() {
    if (calculateFrequency) {        // If the time interrupt has been triggered and the next peak after the last time point has been reached. Now we want to calculate the frequency of the past second.
        noInterrupts();              // Disable interrupts to protect the data from the interrupts.
        calculateFrequency = false;  // Reset the flag to indicate that the frequency calculation has been triggered.

        // Backup variables
        unsigned long storedVariables[7];                      // Array to store the variables for the frequency calculation.
        float peaks[2];                                        // Array to store the peaks for the frequency calculation.
        storeVariablesForCalculation(storedVariables, peaks);  // Store the variables for the frequency calculation.

        // Calculate Frequency in the last second
        float frequency = calculateCurrentFrequency(storedVariables[0], storedVariables[1], storedVariables[2], storedVariables[3], storedVariables[4], storedVariables[5], storedVariables[6], peaks[0], peaks[1]);

        interrupts();                                   // Enable interrupts again.
        printFrequency(frequency, storedVariables[3]);  // Print the frequency to the serial port (in binary format: POSIX-Time, Frequency 4 Bytes each).
    }
}
/**
 * @brief Calculate the time points for the frequency calculation in order to protect the data from the interrupt.
 * And preserve the raw values as well.
 */
void storeVariablesForCalculation(unsigned long storedVariables[], float peaks[]) {
    // Calculate the times between interrupt and peak events
    storedVariables[0] = microsPeakCurrent - microsPeakBefore;     // Calculate the time between the last two peaks.
    storedVariables[1] = microsTimeInterrupt - microsPeakBefore;   // Calculate the time between the last peak and the time interrupt.
    storedVariables[2] = microsPeakCurrent - microsTimeInterrupt;  // Calculate the time between the time interrupt and the first peak in the current time window.
    storedVariables[3] = unixTime;                                 // Save the unix time of the current time window.
    storedVariables[4] = microsPeakBefore;                         // Save the time point of the second to last peak.
    storedVariables[5] = microsPeakCurrent;                        // Save the time point of the last peak.
    storedVariables[6] = microsTimeInterrupt;                      // Save the time point of the time interrupt.

    peaks[0] = float(countBefore);         // Save the count of the last time window.
    peaks[1] = missedFractionalPeakStart;  // Save the missed fractional peak between at the start of the current time window, which is provided by the last iteration.
}

/**
 * @brief Calculate the frequency in the last second a
 * This method also calculates the missed fractional peak between last peak in the time window and time interrupt, as well as the
 * fractional peak at the beginning of the current time window.
 */
float calculateCurrentFrequency(unsigned long timeBetweenPeaks, unsigned long timeBetweenLastPeakAndInterrupt, unsigned long timeBetweenInterruptAndCurrentPeak, unsigned long storedUnixTime, unsigned long storedMicrosPeakBefore, unsigned long storedMicrosPeakCurrent, unsigned long storedMicrosTimeInterrupt, float storedCounts, float storedMissedFractionalPeakStart) {
    // Calculate the fractional peaks
    missedFractionalPeakEnd = (float)timeBetweenLastPeakAndInterrupt / (float)timeBetweenPeaks;  // Calculate the fractional peak at the end of the last time window based on the relation between the last peak and the time, which passed the time interrupt triggered.

    float countNormalized = (storedCounts + missedFractionalPeakEnd + storedMissedFractionalPeakStart) - 1.0;  // Add the fractional peaks to the counter and subtract 1, because one peak is already counted. => Avoids double counting.

    // Calculate the frequency
    currentFrequency = countNormalized * 0.5;                                                         // Calculate the frequency in Hz => Normalize down to 50 Hz base frequency vs. 100 Hz from the bridge rectifier.
    missedFractionalPeakStart = float(timeBetweenInterruptAndCurrentPeak) / float(timeBetweenPeaks);  // Calculate the fractional peak at the beginning of the current time window based on the relation between the time interrupt and the first peak in the next time window. Provided for the next iteration.
    return currentFrequency;                                                                          // Return the calculated frequency.
}

/**
 * @brief Print the frequency to the serial port in binary format. 4 Bytes for the POSIX time as uInt and 4 Bytes for the frequency as float.
 */
void printFrequency(float currentFrequency, unsigned long currentUnixTime) {
    byte *unixTimePointer = (byte *)&currentUnixTime;    // Set pointer to the unsigned long in order to send it as byte.
    byte *frequencyPointer = (byte *)&currentFrequency;  // Set pointer to the Float in order to send it as byte.

    // Print the frequency and the unix Timestamp to Serial as binary
    // Serial.println(currentFrequency,5);
    Serial.write(unixTimePointer, 4);   // 4 is the sizeof(unsigned long)
    Serial.write(frequencyPointer, 4);  // 4 is the sizeof(float)
}

/**
 * @brief Interrupt Service Routine for the time interrupt
 */
void timeInterruptISR() {
    microsInterruptBefore = microsTimeInterrupt;
    unixTime += 1;                   // Increment POSIX Time.
    microsTimeInterrupt = micros();  // Save the time when the interrupt was triggered.
    timeInterrupt = true;            // Set the flag to calculate the frequency.
    countBefore = count;             // Save the count of the last time window.
    count = 0;                       // Reset the counter.
}

/**
 * @brief Interrupt for the frequency signal from the grid.
 */
void handlePeakEventISR() {
    microsPeakBefore = microsPeakCurrent;  // Save timestamp of the last peak.
    microsPeakCurrent = micros();          // Save timestamp of the current peak.
    count++;                               // Increase the counter // If the sensor value changed from 0 to 1.
    if (timeInterrupt) {                   // If the time interrupt has been triggered and the next peak after the last time point has been reached. Now we want to calculate the frequency of the past second.
        timeInterrupt = false;             // Reset the flag to indicate that the frequency calculation has been triggered. And it is not longer needed until the next time interrupt.
        calculateFrequency = true;         // Set the flag to calculate the frequency.
    }
}
