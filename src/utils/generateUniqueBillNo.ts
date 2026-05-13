// const StudentModel = require('../Models/student.model')
import StudentModel from './../Models/student.model.js';

const generateUniqueBillNo = async (length = 5) => {
    let billNo;
    let existingBillNos = await StudentModel.find({
        $or: [
            { admissionBillNo: { $exists: true } },
            { firstTermBillNo: { $exists: true } },
            { secondTermBillNo: { $exists: true } },
        ]
    }, {
        admissionBillNo: 1,
        firstTermBillNo: 1,
        secondTermBillNo: 1
    });

    // Flatten all bill numbers from the database into one set
    const existingBillNosSet = new Set(existingBillNos.map(doc => [
        doc.admissionBillNo,
        doc.firstTermBillNo,
        doc.secondTermBillNo
    ]).flat());

    // First, try generating a 5-digit bill number
    while (true) {
        // Generate a random 5-digit number between 10000 and 99999
        billNo = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;

        // If the bill number is unique, return it
        if (!existingBillNosSet.has(billNo)) {
            return billNo;
        }

        // If 5-digit numbers are not unique, break out and increase length
        if (length === 5) {
            length = 6; // Increase the length to 6 digits if 5 digits are not unique
            break;
        }
    }

    // Now, try generating a 6-digit bill number (and higher if needed)
    while (true) {
        // Generate a random number based on the current length
        if (length === 6) {
            // Generate a random 6-digit number between 100000 and 999999
            billNo = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
        } else {
            // For lengths greater than 6, increase the upper range accordingly
            billNo = Math.floor(Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1))) + Math.pow(10, length - 1);
        }

        // Check if the bill number is unique
        if (!existingBillNosSet.has(billNo)) {
            return billNo;  // Return if it's unique
        }

        // If the number is still not unique, increase the length and try again
        length++;
    }
};


export default generateUniqueBillNo;

// module.exports = generateUniqueBillNo