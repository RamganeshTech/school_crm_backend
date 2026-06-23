
// ==========================================
// 1. CREATE A NEW SCHOOL

import type { Response } from "express";
import SchoolModel from "../../../models/New_Model/SchoolModel/schoolModel.model.js";
import { isValidEmail, isValidPhone } from "../../../utils/basicValidation.js";
// import { uploadImageToS3 } from "../../../Utils/s3upload.js";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import mongoose from "mongoose";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
// import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";

// ==========================================
export const createSchool = async (req: RoleBasedRequest, res: Response) => {
  try {

    const isPlatformAdmin = req?.user?.isPlatformAdmin || false

    if (!isPlatformAdmin) {
      return res.status(403).json({ message: "sorry you cant create the school", ok: false })
    }


    let { name, email, phoneNo, address, currentAcademicYear } = req.body;



    const file = req.file; // ✅ multer puts file here

    name = name?.trim();
    email = email?.trim();
    phoneNo = phoneNo?.trim();
    address = address?.trim();
    currentAcademicYear = currentAcademicYear?.trim();

    if (!isPlatformAdmin) {
      return res.status(403).json({
        message: "You do not have permission to create a school. Please contact the platform administrator.",
        ok: false
      })
    }


    console.log("file 11111111", file)

    if (!isPlatformAdmin) {
      return res.status(403).json({
        message: "You do not have permission to create a school. Please contact the platform administrator.",
        ok: false
      })
    }

    // Validation: Ensure Name is provided
    if (!name) {
      return res.status(400).json({ message: "School Name is required.", ok: false });
    }

    if (!currentAcademicYear) {
      return res.status(400).json({ message: "Current academic year is required.", ok: false });

    }


    // 2. Validate formats (assuming you have these helpers)
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format", ok: false });
    }

    if (phoneNo && !isValidPhone(phoneNo)) {
      return res.status(400).json({ message: "Invalid phone number format", ok: false });
    }


    // 5. Check for Conflicts (Name, Email, Phone)
    // We build a query to check all 3 at once
    const conflictChecks = [];
    if (name) conflictChecks.push({ name });
    if (email) conflictChecks.push({ email });
    if (phoneNo) conflictChecks.push({ phoneNo });

    if (conflictChecks.length > 0) {
      const duplicate = await SchoolModel.findOne({ $or: conflictChecks });

      if (duplicate) {
        if (duplicate.name === name) {
          return res.status(400).json({ message: "School Name already exists.", ok: false });
        }
        if (duplicate.email === email) {
          return res.status(400).json({ message: "Email already exists.", ok: false });
        }
        if (duplicate.phoneNo === phoneNo) {
          return res.status(400).json({ message: "Phone number already exists.", ok: false });
        }
      }
    }


    let uploadedLogo = null


    if (file) {
      const uploadResult = await uploadFileToS3New(file);
      uploadedLogo = {
        type: file.mimetype.startsWith("image") ? "image" : "pdf",
        key: uploadResult.key,
        url: uploadResult.url,
        originalName: file.originalname,
        uploadedAt: new Date()
      };

    }
    console.log("file after upload 22222233", uploadedLogo)


    // Create the School
    const newSchool = new SchoolModel({
      name,
      email,
      phoneNo,
      address,
      logo: uploadedLogo,
      currentAcademicYear: currentAcademicYear,
      isActive: true, // Default to true
    });

    await newSchool.save();

    await createAuditLog(req, {
      action: "create",
      module: "school",
      targetId: newSchool?._id,
      description: `school created (${newSchool._id})`,
      status: "success"
    });

    return res.status(201).json({
      message: "School created successfully",
      data: newSchool,
      ok: true
    });
  } catch (error: any) {
    console.error("Error creating school:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message, ok: false });
  }
};

// ==========================================
// 2. GET ALL SCHOOLS
// ==========================================
export const getAllSchools = async (req: RoleBasedRequest, res: Response) => {
  try {
    // Fetches all schools. You can add pagination here later if needed.
    const schools = await SchoolModel.find().sort({ createdAt: -1 });

    return res.status(200).json({
      ok: true,
      count: schools.length,
      data: schools,
    });
  } catch (error: any) {
    console.error("Error fetching schools:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ==========================================
// 3. GET SINGLE SCHOOL BY ID
// ==========================================
export const getSchoolById = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const school = await SchoolModel.findById(id);

    if (!school) {
      return res.status(404).json({ message: "School not found.", ok: false });
    }

    return res.status(200).json({ ok: true, data: school });
  } catch (error: any) {
    console.error("Error fetching school:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message, ok: false });
  }
};

// ==========================================
// 4. UPDATE SCHOOL DETAILS
// ==========================================
export const updateSchool = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phoneNo, address, currentAcademicYear } = req.body;


    const updates: any = {};

    if (name) updates.name = name.trim();
    if (email) updates.email = email.trim();
    if (phoneNo) updates.phoneNo = phoneNo.trim();
    if (address) updates.address = address.trim();
    if (currentAcademicYear) updates.currentAcademicYear = currentAcademicYear.trim();

    if (!currentAcademicYear) {
      return res.status(400).json({ message: "Current Academic year cannot be null", ok: false });
    }

    // Prevent schoolCode updates
    if (req.body.schoolCode) {
      return res.status(400).json({ message: "School code cannot be updated", ok: false });
    }


    // 2. Validate formats (assuming you have these helpers)
    if (updates.email && !isValidEmail(updates.email)) {
      return res.status(400).json({ message: "Invalid email format", ok: false });
    }

    if (updates.phoneNo && !isValidPhone(updates.phoneNo)) {
      return res.status(400).json({ message: "Invalid phone number format", ok: false });
    }


    // Check for duplicate school name
    // if (name) {
    //   const existingSchool = await SchoolModel.findOne({ name, _id: { $ne: id } });
    //   if (existingSchool) {
    //     return res.status(400).json({ message: "School name already exists", ok: false });
    //   }
    // }

    // Check for duplicates in a single DB call
    // Single query to find any conflict
    // 3. Dynamic Duplicate Check
    // Build the query array dynamically based on what is being updated
    const conflictChecks = [];
    if (updates.name) conflictChecks.push({ name: updates.name });
    if (updates.email) conflictChecks.push({ email: updates.email });
    if (updates.phoneNo) conflictChecks.push({ phoneNo: updates.phoneNo });

    // ONLY run the DB query if there is something to check
    if (conflictChecks.length > 0) {
      const duplicate = await SchoolModel.findOne({
        _id: { $ne: id }, // Exclude current school
        $or: conflictChecks
      });

      if (duplicate) {
        // We use 'updates' here to compare against the DB result
        if (updates.name && duplicate.name === updates.name) {
          return res.status(400).json({ message: "School name already exists", ok: false });
        }
        if (updates.email && duplicate.email === updates.email) {
          return res.status(400).json({ message: "Email already exists", ok: false });
        }
        if (updates.phoneNo && duplicate.phoneNo === updates.phoneNo) {
          return res.status(400).json({ message: "Phone number already exists", ok: false });
        }
      }
    }



    // // Check if the school exists
    // const school = await SchoolModel.findById(id);
    // if (!school) {
    //   return res.status(404).json({ ok: false, message: "School not found." });
    // }

    // Update the school
    // { new: true } returns the updated document instead of the old one
    const updatedSchool = await SchoolModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });


    await createAuditLog(req, {
      action: "edit",
      module: "school",
      targetId: updatedSchool?._id!,
      description: `school updated (${updatedSchool!._id})`,
      status: "success"
    });

    return res.status(200).json({
      ok: true,
      message: "School updated successfully",
      data: updatedSchool,
    });
  } catch (error: any) {
    console.error("Error updating school:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message, ok: false });
  }
};



export const updateSchoolLogo = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file; // ✅ multer puts file here

    // Check if the school exists


    if (!file) {
      return res.status(404).json({ message: "logo not found.", ok: false });
    }


    // const uploadedUrl = await uploadImageToS3(file)

    // let uploadedLogo = {
    //   type: "image",
    //   originalName: file?.originalname,
    //   url: uploadedUrl,
    // }

    const uploadResult = await uploadFileToS3New(file);
    let uploadedLogo = {
      type: file.mimetype.startsWith("image") ? "image" : "pdf",
      key: uploadResult.key,
      url: uploadResult.url,
      originalName: file.originalname,
      uploadedAt: new Date()
    };



    // const school = await SchoolModel.findById(id);
    // if (!school) {
    //   return res.status(404).json({ message: "School not found." });
    // }


    // Update the school
    // { new: true } returns the updated document instead of the old one
    const updatedSchool = await SchoolModel.findByIdAndUpdate(id, { logo: uploadedLogo }, {
      new: true,
    });

    await createAuditLog(req, {
      action: "edit",
      module: "school",
      targetId: updatedSchool?._id!,
      description: `school logo updated (${updatedSchool!._id})`,
      status: "success"
    });

    return res.status(200).json({
      message: "School logo updated successfully",
      data: updatedSchool,
      ok: false
    });
  } catch (error: any) {
    console.error("Error updating school:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message, ok: false });
  }
};

// ==========================================
// 5. DELETE SCHOOL
// ==========================================
export const deleteSchool = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // const school = await SchoolModel.findById(id);


    // Hard Delete: Removes it from the database completely
    const school = await SchoolModel.findByIdAndDelete(id);

    if (!school) {
      return res.status(404).json({ message: "School not found.", ok: false });
    }


    await archiveData({
      schoolId: school._id,
      category: "school",
      originalId: school._id,
      deletedData: school.toObject(), // Convert Mongoose doc to plain object
      deletedBy: req.user!._id || null,
      reason: null, // Optional reason from body
    });

    await createAuditLog(req, {
      action: "delete",
      module: "school",
      targetId: school?._id,
      description: `school deleted (soft delete) (${school._id})`,
      status: "success"
    });

    // Note: In an LMS, usually we prefer "Soft Delete" (setting isActive: false)
    // to preserve history. If you want that, replace the line above with:
    // await SchoolModel.findByIdAndUpdate(id, { isActive: false });

    return res.status(200).json({ message: "School deleted successfully.", ok: false });
  } catch (error: any) {
    console.error("Error deleting school:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message, ok: false });
  }
};




//  SOCIAL MEDIA HANDLES

export const updateSocialPlatform = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { socialPlatform, link } = req.body;


    const updates = {};

    const platforms = ["instagram", "facebook", "linkedin", "youtube"]

    if (!platforms.includes(socialPlatform)) {
      return res.status(400).json({ message: `playform should contain only these values ${platforms.join(", ")} `, ok: false });
    }


    // if (link) updates.link = link.trim();


    const updatePath = `socialPlatform.${socialPlatform}`;
    const updatedSchool = await SchoolModel.findByIdAndUpdate(id,
      { [updatePath]: link },
      {
        new: true,
        runValidators: true,
      });

    if (!updatedSchool) {
      return res.status(404).json({ message: "School not found", ok: false });
    }

    await createAuditLog(req, {
      action: "edit",
      module: "school",
      targetId: updatedSchool?._id,
      description: `school updated (${updatedSchool._id})`,
      status: "success"
    });

    return res.status(200).json({
      ok: true,
      message: "School platform updated successfully",
      data: updatedSchool,
    });
  } catch (error: any) {
    console.error("Error updating school social plotform:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message, ok: false });
  }
};




export const getSchoolSocialPlatforms = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const school = await SchoolModel.findById(id).select("socialPlatform name")

    if (!school) {
      return res.status(404).json({ message: "School not found.", ok: false });
    }

    return res.status(200).json({ ok: true, data: school });
  } catch (error: any) {
    console.error("Error fetching school social platforms:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message, ok: false });
  }
};




export const upsertAcademicTermDates = async (req: RoleBasedRequest, res: Response) => {
  try {


    const { id } = req.params
    const { academicYear, firstTerm, secondTerm, thirdTerm } = req.body;

    if (!id || !academicYear) {
      return res.status(400).json({
        ok: false,
        message: "schoolId and academicYear are required."
      });
    }

    const schoolObjId = new mongoose.Types.ObjectId(id as string);

    // 🌟 STEP 1: Attempt to UPDATE if the academicYear already exists
    const updatedSchool = await SchoolModel.findOneAndUpdate(
      {
        _id: schoolObjId,
        "academicTermDates.academicYear": academicYear
      },
      {
        $set: {
          "academicTermDates.$.firstTerm": firstTerm || null,
          "academicTermDates.$.secondTerm": secondTerm || null,
          "academicTermDates.$.thirdTerm": thirdTerm || null,
        }
      },
      { new: true }
    );

    // 🌟 STEP 2: If it didn't exist (update failed), PUSH a new record
    if (!updatedSchool) {
      const newSchoolData = await SchoolModel.findByIdAndUpdate(
        schoolObjId,
        {
          $push: {
            academicTermDates: {
              academicYear,
              firstTerm: firstTerm || null,
              secondTerm: secondTerm || null,
              thirdTerm: thirdTerm || null
            }
          }
        },
        { new: true }
      );

      if (!newSchoolData) {
        return res.status(404).json({ ok: false, message: "School not found." });
      }

      return res.status(200).json({
        ok: true,
        message: "Term dates created successfully.",
        data: newSchoolData.academicTermDates
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Term dates updated successfully.",
      data: updatedSchool.academicTermDates
    });

  } catch (error: any) {
    console.error("Upsert Term Dates Error:", error);
    return res.status(500).json({ ok: false, message: "Failed to save term dates." });
  }
};


export const deleteAcademicTermDates = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { schoolId, academicTermDateId } = req.params; // Usually passed as query params for DELETE requests

    if (!schoolId || !academicTermDateId) {
      return res.status(400).json({
        ok: false,
        message: "schoolId and academicYear are required."
      });
    }

    const schoolObjId = new mongoose.Types.ObjectId(schoolId as string);

    // 🌟 USE $pull to remove the specific object from the array
    const updatedSchool = await SchoolModel.findByIdAndUpdate(
      schoolObjId,
      {
        $pull: {
          academicTermDates: { _id: academicTermDateId as string }
        }
      },
      { new: true }
    );

    if (!updatedSchool) {
      return res.status(404).json({ ok: false, message: "School not found." });
    }

    return res.status(200).json({
      ok: true,
      message: `Term dates deleted successfully.`,
      data: updatedSchool.academicTermDates
    });

  } catch (error: any) {
    console.error("Delete Term Dates Error:", error);
    return res.status(500).json({ ok: false, message: "Failed to delete term dates." });
  }
};