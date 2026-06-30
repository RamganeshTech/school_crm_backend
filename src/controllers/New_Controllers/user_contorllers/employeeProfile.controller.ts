import { type Response } from "express";
import mongoose, { type AnyConnectionBulkWriteModel } from "mongoose";
import UserModel from "../../../models/New_Model/UserModel/userModel.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js"; // Adjust based on your types
import EmployeeProfileModel from "../../../models/New_Model/UserModel/employeeProfile.model.js";
import { isValidPhone } from "../../../utils/basicValidation.js";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";

// ==========================================
// 1. ONBOARD STAFF (Combined Create)
// ==========================================
// ==========================================
// 1. CREATE EMPLOYEE PROFILE
// ==========================================
export const createEmployeeProfile = async (req: RoleBasedRequest, res: Response) => {
    try {
        const {
            userId, schoolId, employeeNo, designation, department, dateOfJoining, employmentType,
            nationalId, pfNumber, yearsOfExperience, previousWorkplace,
            bankDetails, emergencyContact,
            educationDetails,aadharNumber,

            currentAddress,
            permanentAddress
        } = req.body;


        const parsedBankDetails = typeof bankDetails === "string" ? JSON.parse(bankDetails) : bankDetails;
        const parsedEmergencyContact = typeof emergencyContact === "string" ? JSON.parse(emergencyContact) : emergencyContact;
        const parsedEducationDetails = typeof educationDetails === "string" ? JSON.parse(educationDetails) : educationDetails;

        if (!userId || !schoolId) {
            return res.status(400).json({ ok: false, message: "userId and schoolId are required." });
        }

        // 🌟 Phone Number Validation
        if (emergencyContact?.phone && !isValidPhone(emergencyContact.phone)) {
            return res.status(400).json({
                ok: false,
                message: "Invalid emergency contact phone number. It must be exactly 10 digits."
            });
        }

        // 1. Check if this user already has a profile
        const existingProfile = await EmployeeProfileModel.findOne({ userId });
        if (existingProfile) {
            return res.status(400).json({ ok: false, message: "An employee profile already exists for this user." });
        }

        // 2. Check if employeeNo is already used in this school
        if (employeeNo) {
            const existingEmployeeNo = await EmployeeProfileModel.findOne({ schoolId, employeeNo });
            if (existingEmployeeNo) {
                return res.status(400).json({ ok: false, message: `Employee Number ${employeeNo} is already assigned in this school.` });
            }
        }


        let attachments: any[] = [];
        if (req.files && (req?.files?.length as number) > 0) {
            attachments = await Promise.all(
                (req.files as []).map(async (file: any) => {
                    const uploadData = await uploadFileToS3New(file);

                    // Determine Type
                    let fileType = "pdf";
                    if (file.mimetype.startsWith("image/")) fileType = "image";
                    else if (file.mimetype.startsWith("video/")) fileType = "video";

                    return {
                        _id: new mongoose.Types.ObjectId(),
                        type: fileType,
                        key: uploadData.key,
                        url: uploadData.url,
                        originalName: file.originalname,
                        uploadedAt: new Date()
                    };
                })
            );
        }

        // 3. Create the Employee Profile
        const newProfile = new EmployeeProfileModel({
            userId, schoolId, employeeNo, designation, department, dateOfJoining, employmentType,
            nationalId, pfNumber, educationDetails: parsedEducationDetails, yearsOfExperience, previousWorkplace,
            bankDetails: parsedBankDetails, emergencyContact: parsedEmergencyContact,

            documents: attachments,

            currentAddress,
            permanentAddress,
            aadharNumber
        });

        await newProfile.save();

        return res.status(201).json({
            ok: true,
            data: newProfile,
            message: "Employee profile created successfully."
        });

    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ==========================================
// 4. UPDATE EMPLOYEE PROFILE
// ==========================================
export const updateEmployeeProfile = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const {
            employeeNo, designation, department, dateOfJoining, employmentType,
            nationalId, pfNumber, educationDetails, yearsOfExperience, previousWorkplace,
            bankDetails, emergencyContact, isActive,

            currentAddress,
            aadharNumber,
            permanentAddress

        } = req.body;

        // Ensure unique employeeNo check if they are trying to change it
        if (employeeNo) {
            const profileToUpdate = await EmployeeProfileModel.findOne({ userId });
            if (profileToUpdate && profileToUpdate.employeeNo !== employeeNo) {
                const existingNo = await EmployeeProfileModel.findOne({ schoolId: profileToUpdate.schoolId, employeeNo });
                if (existingNo) {
                    return res.status(400).json({ ok: false, message: `Employee Number ${employeeNo} is already in use.` });
                }
            }
        }

        // 🌟 Phone Number Validation
        if (emergencyContact?.phone && !isValidPhone(emergencyContact.phone)) {
            return res.status(400).json({
                ok: false,
                message: "Invalid emergency contact phone number. It must be exactly 10 digits."
            });
        }

        const updateData: any = {};
        if (employeeNo !== undefined) updateData.employeeNo = employeeNo;
        if (designation !== undefined) updateData.designation = designation;
        if (department !== undefined) updateData.department = department;
        if (dateOfJoining !== undefined) updateData.dateOfJoining = dateOfJoining;
        if (employmentType !== undefined) updateData.employmentType = employmentType;
        if (nationalId !== undefined) updateData.nationalId = nationalId;
        if (pfNumber !== undefined) updateData.pfNumber = pfNumber;
        // if (qualifications !== undefined) updateData.qualifications = qualifications;
        if (educationDetails !== undefined) updateData.educationDetails = educationDetails;
        if (yearsOfExperience !== undefined) updateData.yearsOfExperience = yearsOfExperience;
        if (previousWorkplace !== undefined) updateData.previousWorkplace = previousWorkplace;
        if (bankDetails !== undefined) updateData.bankDetails = bankDetails;
        if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (currentAddress !== undefined) updateData.currentAddress = currentAddress;
        if (permanentAddress !== undefined) updateData.permanentAddress = permanentAddress;
        if (aadharNumber !== undefined) updateData.aadharNumber = aadharNumber;

        const updatedProfile = await EmployeeProfileModel.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate("userId", "userName email phoneNo role");

        if (!updatedProfile) {
            return res.status(404).json({ ok: false, message: "Employee profile not found." });
        }

        return res.status(200).json({
            ok: true,
            data: updatedProfile,
            message: "Employee profile updated successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


// ==========================================
// 2. GET ALL STAFF (With Pagination & Filters)
// ==========================================
export const getAllEmployeeProfiles = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { schoolId, department, designation, isActive, page = 1, limit = 10 } = req.query;

        const filter: any = { schoolId };

        if (department) filter.department = department;
        if (designation) filter.designation = designation;
        if (isActive !== undefined) filter.isActive = isActive === 'true';

        const skip = (Number(page) - 1) * Number(limit);

        // Fetch profiles and populate the linked User data (name, email, photo, etc.)
        const profiles = await EmployeeProfileModel.find(filter)
            .populate("userId", "userName email phoneNo role profileImage")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await EmployeeProfileModel.countDocuments(filter);

        return res.status(200).json({
            ok: true,
            count: profiles.length,
            total,
            data: profiles,
            message: "Staff profiles fetched successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


// ==========================================
// 3. GET SINGLE PROFILE BY USER ID
// ==========================================
export const getEmployeeProfileByUserId = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId } = req.params;

        const profile = await EmployeeProfileModel.findOne({ userId })
            .populate("userId", "userName email phoneNo role profileImage isPlatformAdmin");

        if (!profile) {
            return res.status(200).json({ ok: true, message: "Employee profile not found for this user.", data: null });
        }

        return res.status(200).json({ ok: true, data: profile });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};



// ==========================================
// 6. SOFT DELETE PROFILE ONLY (Offboard)
// ==========================================
export const deleteEmployeeProfile = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId } = req.params;

        // Strictly update isActive on the profile. 
        // We explicitly DO NOT touch the UserModel here based on your rules.
        const offboardedProfile = await EmployeeProfileModel.findOneAndDelete(
            { userId },
        );

        if (!offboardedProfile) {
            return res.status(404).json({
                ok: false,
                message: "Employee profile not found. Cannot offboard."
            });
        }

        return res.status(200).json({
            ok: true,
            message: `Employee profile for employee number ${offboardedProfile.employeeNo} has been deactivated. The User account remains intact.`
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};



// ==========================================
// ADD DOCUMENTS TO EXISTING EMPLOYEE PROFILE
// ==========================================
export const addEmployeeDocuments = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId } = req.params;

        if (!req.files || (req.files as any[]).length === 0) {
            return res.status(400).json({ ok: false, message: "No files uploaded." });
        }

        const profile = await EmployeeProfileModel.findOne({ userId });
        if (!profile) {
            return res.status(404).json({ ok: false, message: "Employee profile not found." });
        }

        const newAttachments = await Promise.all(
            (req.files as any[]).map(async (file: any) => {
                const uploadData = await uploadFileToS3New(file);

                let fileType = "pdf";
                if (file.mimetype.startsWith("image/")) fileType = "image";
                else if (file.mimetype.startsWith("video/")) fileType = "video";

                return {
                    _id: new mongoose.Types.ObjectId(),
                    type: fileType,
                    key: uploadData.key,
                    url: uploadData.url,
                    originalName: file.originalname,
                    uploadedAt: new Date()
                };
            })
        );

        (profile.documents as any).push(...newAttachments);
        await profile.save();

        return res.status(200).json({
            ok: true,
            data: profile,
            message: "Documents added successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


// ==========================================
// DELETE A SINGLE EMPLOYEE DOCUMENT
// ==========================================
export const deleteEmployeeDocument = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId, documentId } = req.params;

        const profile = await EmployeeProfileModel.findOne({ userId });
        if (!profile) {
            return res.status(404).json({ ok: false, message: "Employee profile not found." });
        }

        const docToDelete = (profile.documents as any).find((doc: any) => doc._id.toString() === documentId);
        if (!docToDelete) {
            return res.status(404).json({ ok: false, message: "Document not found." });
        }

        // // Remove from S3 first (don't block DB cleanup if this fails, but log it)
        // try {
        //     await deleteFileFromS3New(docToDelete.key);
        // } catch (s3Error: any) {
        //     console.error("S3 deletion failed:", s3Error.message);
        // }

        profile.documents = (profile.documents as any).filter((doc: any) => doc._id.toString() !== documentId);
        await profile.save();

        return res.status(200).json({
            ok: true,
            data: profile,
            message: "Document deleted successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


// ==========================================
// ADD SALARY SLIP
// ==========================================
export const addSalarySlip = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const { amount, salaryDate } = req.body;

        const hasAmountOrDate = (amount !== undefined && amount !== null && amount !== "") ||
            (salaryDate !== undefined && salaryDate !== null && salaryDate !== "");
        const hasFile = !!req.file;

        if (!hasAmountOrDate && !hasFile) {
            return res.status(400).json({
                ok: false,
                message: "Provide at least the amount/date or a salary slip file."
            });
        }

        const profile = await EmployeeProfileModel.findOne({ userId });
        if (!profile) {
            return res.status(404).json({ ok: false, message: "Employee profile not found." });
        }

        let fileData: any = null;

        if (hasFile) {
            const file = req.file as any;
            const uploadData = await uploadFileToS3New(file);

            let fileType: "pdf" | "image" = "pdf";
            if (file.mimetype.startsWith("image/")) fileType = "image";


            fileData = {
                _id: new mongoose.Types.ObjectId(),
                type: fileType,
                key: uploadData.key,
                url: uploadData.url,
                originalName: file.originalname,
                uploadedAt: new Date()
            };
        }

        const newSlip = {
            _id: new mongoose.Types.ObjectId(),
            amount: amount ? Number(amount) : null,
            salaryDate: salaryDate ? new Date(salaryDate) : null,
            file: fileData
        };

        profile.salarySlips.push(newSlip);
        await profile.save();

        return res.status(200).json({
            ok: true,
            data: profile,
            message: "Salary slip added successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};

// ==========================================
// DELETE SALARY SLIP
// ==========================================
export const deleteSalarySlip = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId, slipId } = req.params;

        const profile = await EmployeeProfileModel.findOne({ userId });
        if (!profile) {
            return res.status(404).json({ ok: false, message: "Employee profile not found." });
        }

        const slipToDelete = profile.salarySlips.find((s: any) => s._id.toString() === slipId);
        if (!slipToDelete) {
            return res.status(404).json({ ok: false, message: "Salary slip not found." });
        }

        // if (slipToDelete.file?.key) {
        //     try {
        //         await deleteFileFromS3New(slipToDelete.file.key);
        //     } catch (s3Error: any) {
        //         console.error("S3 deletion failed:", s3Error.message);
        //     }
        // }

        profile.salarySlips = profile.salarySlips.filter((s: any) => s._id.toString() !== slipId);
        await profile.save();

        return res.status(200).json({
            ok: true,
            data: profile,
            message: "Salary slip deleted successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};


//  NEW VERSION

const ALLOWED_FIELDS = [
    "employeeNo", "designation", "department", "dateOfJoining", "employmentType",
    "nationalId", "pfNumber", "yearsOfExperience", "previousWorkplace",
    "currentAddress", "permanentAddress", "educationDetails",
    "bankDetails", "emergencyContact", "aadharNumber"
];

export const upsertEmployeeProfile = async (req: RoleBasedRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const { schoolId, salaryAmount, salaryDate, ...rest } = req.body;

        if (rest.emergencyContact && typeof rest.emergencyContact === "string") {
            rest.emergencyContact = JSON.parse(rest.emergencyContact);
        }
        if (rest.bankDetails && typeof rest.bankDetails === "string") {
            rest.bankDetails = JSON.parse(rest.bankDetails);
        }
        if (rest.educationDetails && typeof rest.educationDetails === "string") {
            rest.educationDetails = JSON.parse(rest.educationDetails);
        }

        if (rest.emergencyContact?.phone && !isValidPhone(rest.emergencyContact.phone)) {
            return res.status(400).json({
                ok: false,
                message: "Invalid emergency contact phone number. It must be exactly 10 digits."
            });
        }

        const setData: any = {};
        for (const field of ALLOWED_FIELDS) {
            if (rest[field] !== undefined) setData[field] = rest[field];
        }

        const files = req.files as { [fieldname: string]: any[] } | undefined;
        const documentFiles = files?.documents || [];
        const salarySlipFile = files?.salarySlipFile?.[0];

        const newDocuments = await Promise.all(
            documentFiles.map(async (file: any) => {
                const uploadData = await uploadFileToS3New(file);
                let fileType = "pdf";
                if (file.mimetype.startsWith("image/")) fileType = "image";
                else if (file.mimetype.startsWith("video/")) fileType = "video";

                return {
                    _id: new mongoose.Types.ObjectId(),
                    type: fileType,
                    key: uploadData.key,
                    url: uploadData.url,
                    originalName: file.originalname,
                    uploadedAt: new Date()
                };
            })
        );

        const hasSalaryInput = salarySlipFile || salaryAmount || salaryDate;
        let newSalarySlip: any = null;

        if (hasSalaryInput) {
            let salaryFileData: any = null;
            if (salarySlipFile) {
                const uploadData = await uploadFileToS3New(salarySlipFile);
                let fileType: "pdf" | "image" = "pdf";
                if (salarySlipFile.mimetype.startsWith("image/")) fileType = "image";

                salaryFileData = {
                    _id: new mongoose.Types.ObjectId(),
                    type: fileType,
                    key: uploadData.key,
                    url: uploadData.url,
                    originalName: salarySlipFile.originalname,
                    uploadedAt: new Date()
                };
            }

            newSalarySlip = {
                _id: new mongoose.Types.ObjectId(),
                amount: salaryAmount ? Number(salaryAmount) : null,
                salaryDate: salaryDate ? new Date(salaryDate) : null,
                file: salaryFileData
            };
        }

        let profile = await EmployeeProfileModel.findOne({ userId });

        if (!profile) {
            if (!schoolId) {
                return res.status(400).json({ ok: false, message: "schoolId is required to create a new employee profile." });
            }
            profile = new EmployeeProfileModel({
                userId,
                schoolId,
                ...setData,
                documents: newDocuments,
                salarySlips: newSalarySlip ? [newSalarySlip] : []
            });
            await profile.save();
        } else {
            const updateOps: any = {};
            if (Object.keys(setData).length > 0) updateOps.$set = setData;

            const pushOps: any = {};
            if (newDocuments.length > 0) pushOps.documents = { $each: newDocuments };
            if (newSalarySlip) pushOps.salarySlips = newSalarySlip;
            if (Object.keys(pushOps).length > 0) updateOps.$push = pushOps;

            if (Object.keys(updateOps).length > 0) {
                profile = await EmployeeProfileModel.findOneAndUpdate(
                    { userId },
                    updateOps,
                    { new: true, runValidators: true }
                );
            }
        }

        return res.status(200).json({
            ok: true,
            data: profile,
            message: "Profile saved successfully."
        });
    } catch (error: any) {
        return res.status(500).json({ ok: false, message: error.message });
    }
};