import { type Response } from "express";
import mongoose from "mongoose";
import UserModel from "../../../models/New_Model/UserModel/userModel.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js"; // Adjust based on your types
import EmployeeProfileModel from "../../../models/New_Model/UserModel/employeeProfile.model.js";
import { isValidPhone } from "../../../utils/basicValidation.js";

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
            nationalId, pfNumber, qualifications, yearsOfExperience, previousWorkplace,
            bankDetails, emergencyContact
        } = req.body;

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

        // 3. Create the Employee Profile
        const newProfile = new EmployeeProfileModel({
            userId, schoolId, employeeNo, designation, department, dateOfJoining, employmentType,
            nationalId, pfNumber, qualifications, yearsOfExperience, previousWorkplace,
            bankDetails, emergencyContact
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
            nationalId, pfNumber, qualifications, yearsOfExperience, previousWorkplace,
            bankDetails, emergencyContact, isActive
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
        if (qualifications !== undefined) updateData.qualifications = qualifications;
        if (yearsOfExperience !== undefined) updateData.yearsOfExperience = yearsOfExperience;
        if (previousWorkplace !== undefined) updateData.previousWorkplace = previousWorkplace;
        if (bankDetails !== undefined) updateData.bankDetails = bankDetails;
        if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;
        if (isActive !== undefined) updateData.isActive = isActive;

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
            return res.status(200).json({ ok: true, message: "Employee profile not found for this user." , data: null});
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