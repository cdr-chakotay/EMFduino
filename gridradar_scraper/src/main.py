import argparse
import os
import sys
import tarfile
import time
from datetime import datetime
from datetime import timedelta

import scraper
import save_to_influx


def scrape(token, outputFolder):

    apiKey = token
    print("Starting scrape...")
    nextDay = getNexDayEpoch()
    lastTimestamp = 0
    _write_api = save_to_influx.initWriteAPI()

    if outputFolder:
        fileName = fullDayString() + "-grid_radar" + ".csv"
        currentFile = openFile(outputFolder=outputFolder, fileName=fileName)
        print("Opened file: " + fileName + " This file is used until begin of: " + nextFullDayString())
        print("Epoch of next day is at: " + str(nextDay))
    print("Scraping data until an error occurs or process is stopped... ")

    # Start infinite scraping
    while True:
        try:
            response = scraper.scrape(apiKey, False)
            csvLines = scraper.parseJson(response)

            # Process every line
            for line in csvLines:
                # If the timestamp of the line is greater than the last saved timestamp, else pass.
                if line[0] > lastTimestamp:
                    lineString = str(line[0]) + ", " + str(line[1]) + ", " + line[2] + "\n"

                    # If the user wants to write data to a folder as well
                    if outputFolder:

                        # If the timestamp is not in the next day
                        if line[0] <= nextDay:
                            currentFile.write(lineString)
                            save_to_influx.save(line[0], line[1], _write_api)
                            lastTimestamp = line[0]

                        # If the timestamp is in the next day, we need a new file
                        else:
                            # Close file
                            print("Closed file: " + fileName)
                            currentFile.close()

                            # Compress logged Data
                            print("Opening archive: " + fileName + ".tar.xz")
                            with tarfile.open(outputFolder + fileName + ".tar.xz", "w:xz", preset=9) as tar:
                                print("Compressing file: " + fileName)
                                tar.add(outputFolder + fileName)
                                print("Closing Archive")
                                tar.close()

                            # Delete Plaintext in order to save space on disk.
                            delPath = outputFolder + fileName
                            print("Removing File at: " + delPath)
                            if os.path.exists(delPath):
                                os.remove(delPath)
                            else:
                                print("File at '" + delPath + "' does not exists. \n Deletion aborted.")

                            # Open a new file for a new day
                            print("Genertaing new file for new day: ...")
                            fileName = fullDayString() + "-grid_radar" + ".csv"

                            print("Open file: " + fileName + " This file is used until begin of: " + nextFullDayString())
                            currentFile = openFile(outputFolder, fileName)

                            # Set the cutoff time to the next day
                            nextDay = getNexDayEpoch()
                            print("Epoch of next day is at: " + str(nextDay))

                            # Set the timestamp of the current datapoint:
                            lastTimestamp = line[0]

                            print("Storing the first new entries of the day... ")
                            currentFile.write(lineString)
                            save_to_influx.save(line[0], line[1], _write_api)

                            print("Jumping back to main loop ...")
                        
                    else:
                        save_to_influx.save(line[0], line[1], _write_api)
                        lastTimestamp = line[0]

        except Exception as e:
            print("An error occurred, waiting 35 seconds and retrying ...")
            print(str(e))

        time.sleep(35)


def openFile(outputFolder, fileName):
    filePath = outputFolder + "/" + fileName
    currentFile = open(filePath, "a")
    if currentFile.tell() == 0:
        print("Writing header")
        currentFile.write("timestamp, frequency, datetime\n")
    return currentFile


def lastFullHourString():
    # Get the current time
    now = datetime.now()
    last_hour = now.replace(minute=0, second=0, microsecond=0)
    last_hour_string = last_hour.strftime("%Y-%m-%d_%H:%M")
    return last_hour_string


def fullDayString():
    now = datetime.now()
    todayMidnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    todayMidnightString = todayMidnight.strftime("%Y-%m-%d")
    return todayMidnightString


def nextFullDayString():
    tomorrow = datetime.now()
    tomorrow = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = tomorrow + timedelta(days=1)
    return tomorrow.strftime("%Y-%m-%d")


def getNextFullHourEpoch():
    now = datetime.now()
    nextHour = now.replace(hour=now.hour + 1, minute=0, second=0, microsecond=0).timestamp()
    return int(nextHour)


def getNexDayEpoch():
    now = datetime.now()
    todayMidnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    nextDay = todayMidnight + timedelta(days=1)
    epochNextDay = nextDay.timestamp()
    return int(epochNextDay)


def exit_handler(currentFile):
    print("Closing file")
    currentFile.close()
    print("Scraper stopped")


def dir_path(path):
    if os.path.isdir(path):
        return path
    else:
        raise argparse.ArgumentTypeError(f"readable_dir:{path} is not a valid path")


def getAuthKey():
    return os.environ.get("GRIDRADAR_TOKEN")

if len(sys.argv) == 3:
    # Program Start
    parser = argparse.ArgumentParser()
    parser.add_argument('--path', type=dir_path)

    p = parser.parse_args()
    folderPath = os.path.abspath(p.path) + "/"
    
    print("Check if data folder exists...")
    if not os.path.exists(folderPath):
        print("Folder does not exist")
        exit(2)
    else:
        print("Folder exists")
        print("Output folder: " + folderPath)
        scrape(getAuthKey(), folderPath)
else:
    # If no output folder is specified, just write to influx
    print("No output folder specified, starting with Influxdb Config from Env only...")
    scrape(getAuthKey(), None)

