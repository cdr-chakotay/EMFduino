const glob = require('glob');
const fs = require('fs');
const path = require('path');

/**
 * Get Serial Port based on the pattern
 * @param portNamePattern {string} Port Name Pattern
 * @returns {string} Serial Port Address
 */
function getSerialPort(portNamePattern) {
    // Get Serial Ports
    const port = glob.globSync(`*${portNamePattern}*`, { cwd: '/dev/' });
    return `${port[0]}`;
}

/**
 * Resolve Tilde against Home Directory
 * @param pathString
 * @returns {*|string}
 */
function resolveHomeDir(pathString) {
    if (pathString[0] === '~') {
        return path.join(process.env.HOME, pathString.slice(1));
    }
    return pathString;
}

/**
 * Derive Output Path from Input Path and the file extension
 * @param inputPath - Input Path
 * @param format   - Output Format
 * @returns {string} - Output Path
 */
function deriveOutputPathFromInputPath(inputPath, format) {
    let output = inputPath;
    output = output.substring(0, output.lastIndexOf('.')); // Remove file extension
    if (format !== 'stats') {
        output = `${output}.${format}`; // Add file extension
    } else {
        output = `${output}.stats.csv`; // Add file extension
    }
    return output;
}

/**
 * Get Output Path for recursive conversion by joining the output path and the file name.
 * @param inputPath - Input Path
 * @param inputFileExtension - Input File's File Extension
 * @param outputPath - Output Path (Directory)
 * @param format - Output Format, dewtermines the file extension
 * @returns {string} - Output Path with file name and extension
 */
function getOutputPathForRecursiveConversion(inputPath, inputFileExtension, outputPath, format) {
    if (!fs.existsSync(outputPath)) {
        console.error('Output Path does not exist!');
        process.exit(8);
    }

    if (!fs.statSync(outputPath).isDirectory()) {
        console.error('Output Path is not a directory!');
        process.exit(8);
    }

    const fileBaseName = path.basename(inputPath, inputFileExtension);
    const fileExtension = format === 'stats' ? '.stats.csv' : `.${format}`;
    const outFileFullName = `${fileBaseName}${fileExtension}`;
    const output = path.join(outputPath, outFileFullName);
    return output;
}

/**
 * Get Files based on the entered path and extension. Also checks if the path exists
 * @param enteredPath
 * @param extension
 * @param isRecursive - If you want to search through a folder
 * @returns {string[]}
 */
function getFiles(enteredPath, extension, isRecursive) {
    let result;
    const resolvedPath = path.resolve(resolveHomeDir(enteredPath));
    const pathExists = fs.existsSync(resolvedPath);
    if (!pathExists) {
        console.error('Path does not exist!');
        process.exit(8);
    } else {
        const isDirectory = fs.lstatSync(resolvedPath).isDirectory();
        const isFile = fs.lstatSync(resolvedPath).isFile();

        if (isRecursive && isDirectory && !isFile) {
            result = glob.sync(`${resolvedPath}/**/*${extension}`);
        } else if (!isRecursive && isFile && !isDirectory) {
            result = glob.sync(resolvedPath, extension);
        } else {
            console.error(
                'Path is not correct! Please provide an input File, when converting a single File. ' +
                    'Please provide a path to an exisiting Folder, when using the recursive flag.'
            );
            process.exit(8);
        }
    }

    return result;
}

function printLicenseInformation(warranty, conditions) {
    if (warranty) {
        const text = fs.readFileSync('../res/warranty_info', {
            encoding: 'utf-8',
            flag: 'r',
        });
        console.log(text);
    }
    if (conditions) {
        const text = fs.readFileSync('../res/fulltext', {
            encoding: 'utf-8',
            flag: 'r',
        });
        console.log(text);
    }
}

const copyRightNotice =
    'emf_logger_cli  Copyright (C) 2023  Florian Künzig\n' +
    "  This program comes with ABSOLUTELY NO WARRANTY; for details type `show -w'.\n" +
    '  This is free software, and you are welcome to redistribute it\n' +
    "  under certain conditions; type `show -c' for details.";

module.exports = {
    getSerialPort,
    copyRightNotice,
    printLicenseInformation,
    getFiles,
    resolveHomeDir,
    deriveOutputPathFromInputPath,
    getOutputPathForRecursiveConversion,
};
