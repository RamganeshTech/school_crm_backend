// import UserModel from "../models/UserModel.js";
// import ClassModel from "../models/ClassModel.js";
// import SectionModel from "../models/SectionModel.js";
import mongoose from "mongoose";
import UserModel from "../../../models/New_Model/UserModel/userModel.model.js";
import ClassModel from "../../../models/New_Model/SchoolModel/classModel.model.js";
import SectionModel from "../../../models/New_Model/SchoolModel/section.model.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
import type { Response } from "express";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";

// ==========================================
// MANAGE TEACHER ASSIGNMENTS
// Handles: Single Add, Single Remove, Bulk Select All, Bulk Deselect All
// ==========================================
export const manageTeacherAssignments = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { teacherId, updates } = req.body;
    // updates example: [ { classId: "123" }, { classId: "456", sectionId: "789" } ]

    // 1. Basic Validation
    if (!teacherId || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ ok: false, message: "teacherId and updates array are required" });
    }

    const teacher: any = await UserModel.findById(teacherId);
    if (!teacher || teacher.role.toLowerCase() !== "teacher") {
      return res.status(404).json({ ok: false, message: "Teacher not found" });
    }

    // We modify a copy of the assignments array
    let currentAssignments = [...(teacher.assignments || [])];
    let errors = [];

    for (const update of updates) {
      const { classId, sectionId } = update;

      if (!mongoose.Types.ObjectId.isValid(classId)) {
        errors.push(`Invalid Class ID: ${classId}`);
        continue;
      }

      const classDoc = await ClassModel.findById(classId);
      if (!classDoc) {
        errors.push(`Class not found: ${classId}`);
        continue;
      }

      // =========================================================
      // SCENARIO A: BULK ACTION (Only Class ID provided)
      // Logic: If teacher has ANY assignment for this class -> Remove All.
      //        If teacher has NO assignment for this class -> Add All Sections.
      // =========================================================
      if (!sectionId) {

        const hasAssignmentsForClass = currentAssignments.some(
          (asg) => asg.classId.toString() === classId
        );

        if (hasAssignmentsForClass) {
          // >>> DESELECT ALL (Scenario 3: Remove All Grade 10)
          currentAssignments = currentAssignments.filter(
            (asg) => asg.classId.toString() !== classId
          );

          // 2. NEW: Update DB Models (Remove teacherId)
          if (classDoc.hasSections) {
            // Remove teacher from ALL sections of this class
            await SectionModel.updateMany(
              { classId: classId },
              { $pull: { classTeacherId: teacherId } }
            );
          } else {
            // Remove teacher from Class (e.g. LKG)
            await ClassModel.findByIdAndUpdate(classId, {
              $pull: { classTeacherId: teacherId }
            });
          }


        } else {
          // >>> SELECT ALL (Scenario: Add All Grade 10)

          if (classDoc.hasSections) {
            // Fetch all sections for this class from DB
            const allSections = await SectionModel.find({ classId: classId });

            if (allSections.length === 0) {
              errors.push(`Class ${classDoc.name} has no sections to assign.`);
            }

            // Add every section
            allSections.forEach(sec => {
              currentAssignments.push({
                classId: classId,
                sectionId: sec._id
              });
            });

            // 2. NEW: Update DB Models (Add teacherId, no duplicates)
            await SectionModel.updateMany(
              { classId: classId },
              { $addToSet: { classTeacherId: teacherId } }
            );

          } else {
            // For LKG (No sections), just add the class
            currentAssignments.push({
              classId: classId,
              sectionId: null
            });


            // 2. NEW: Update Class Model
            await ClassModel.findByIdAndUpdate(classId, {
              $addToSet: { classTeacherId: teacherId }
            });


          }
        }
        continue; // Move to next update item
      }

      // =========================================================
      // SCENARIO B: SINGLE SECTION TOGGLE
      // Logic: If exists -> Remove. If missing -> Add.
      // =========================================================

      // Validate Section ID if class has sections
      let targetSectionId = null;
      if (classDoc.hasSections) {
        if (!mongoose.Types.ObjectId.isValid(sectionId)) {
          errors.push(`Invalid Section ID for class ${classDoc.name}`);
          continue;
        }
        // Optional: strict check if section belongs to class
        // const secCheck = await SectionModel.findById(sectionId);
        // if(secCheck.classId.toString() !== classId) continue; 

        targetSectionId = sectionId;
      }

      // Check if this specific pair exists
      const existingIndex = currentAssignments.findIndex((asg) => {
        return asg.classId.toString() === classId &&
          String(asg.sectionId) === String(targetSectionId);
      });

      if (existingIndex !== -1) {
        // >>> EXISTS: REMOVE IT (Scenario 1)
        currentAssignments.splice(existingIndex, 1);

        // 2. NEW: Remove from DB Models
        if (classDoc.hasSections) {
          await SectionModel.findByIdAndUpdate(targetSectionId, {
            $pull: { classTeacherId: teacherId }
          });
        } else {
          await ClassModel.findByIdAndUpdate(classId, {
            $pull: { classTeacherId: teacherId }
          });
        }


      } else {
        // >>> MISSING: ADD IT (Scenario 2)
        currentAssignments.push({
          classId: classId,
          sectionId: targetSectionId
        });

        // 2. NEW: Add to DB Models (Prevent Duplicates with $addToSet)
        if (classDoc.hasSections) {
          await SectionModel.findByIdAndUpdate(targetSectionId, {
            $addToSet: { classTeacherId: teacherId }
          });
        } else {
          await ClassModel.findByIdAndUpdate(classId, {
            $addToSet: { classTeacherId: teacherId }
          });
        }


      }
    }

    // 3. Save Changes
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, message: "Validation errors", errors });
    }

    teacher.assignments = currentAssignments;
    await teacher.save();

    await createAuditLog(req, {
      action: "edit",
      module: "teacher",
      targetId: teacherId,
      description: `teacher class assign got updated (${teacherId})`,
      status: "success"
    });

    return res.status(200).json({
      ok: true,
      message: "Assignments updated successfully",
      assignments: teacher.assignments
    });

  } catch (error: any) {
    console.error("Manage Assignments Error:", error);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
};

//  Endpoint: POST /api/teacher/assignments/manage
// Behavior: This API works like a Toggle Switch. It does not "set" data; it flips the state (On -> Off, Off -> On).

// Common Payload Structure:
// JSON

// {
//   "teacherId": "REPLACE_WITH_TEACHER_ID",
//   "updates": [
//      // List of changes to apply
//   ]
// }
// Scenario 1: Single Checkbox (Add a Section)
// Context: The teacher is NOT currently assigned to Grade 10 - Section A.
// Action: Frontend sends the specific Class and Section ID.
// Result: The system ADDS this assignment.
// Payload:

// JSON

// {
//   "teacherId": "TEACHER_ID",
//   "updates": [
//     { 
//       "classId": "GRADE_10_ID", 
//       "sectionId": "SECTION_A_ID" 
//     }
//   ]
// }
// Scenario 2: Single Checkbox (Remove a Section)
// Context: The teacher IS ALREADY assigned to Grade 10 - Section A.
// Action: Frontend sends the exact same payload as Scenario 1.
// Result: The system detects it exists and REMOVES it.
// Payload:

// JSON

// {
//   "teacherId": "TEACHER_ID",
//   "updates": [
//     { 
//       "classId": "GRADE_10_ID", 
//       "sectionId": "SECTION_A_ID" 
//     }
//   ]
// }
// Scenario 3: "Select All" (Bulk Add Class)
// Context: The teacher has ZERO assignments for Grade 10.
// Action: Frontend sends only the classId (Do NOT send sectionId).
// Result: The system fetches all sections (A, B, C...) for Grade 10 and ADDS THEM ALL.
// Payload:

// JSON

// {
//   "teacherId": "TEACHER_ID",
//   "updates": [
//     { 
//       "classId": "GRADE_10_ID" 
//       // Notice: No sectionId here
//     }
//   ]
// }
// Scenario 4: "Deselect All" (Bulk Remove Class)
// Context: The teacher has SOME or ALL assignments for Grade 10 (e.g., they teach 10-A and 10-B).
// Action: Frontend sends only the classId (Same payload as Scenario 3).
// Result: The system detects the teacher has assignments for this class and REMOVES EVERYTHING related to Grade 10.
// Payload:

// JSON

// {
//   "teacherId": "TEACHER_ID",
//   "updates": [
//     { 
//       "classId": "GRADE_10_ID" 
//     }
//   ]
// }
// Scenario 5: Multi-Select (The "Save" Button)
// Context: The Principal clicks multiple checkboxes on the UI and hits "Save Changes".
// Clicks "LKG" (Teacher didn't have it -> Select All).
// Unchecks "Grade 10 - A" (Teacher had it -> Remove).
// Checks "Grade 5 - B" (Teacher didn't have it -> Add).
// Action: Send all changes in one array.
// Result: System processes them sequentially.
// Payload:

// JSON

// {
//   "teacherId": "TEACHER_ID",
//   "updates": [
//     { "classId": "LKG_ID" },                          // Logic: Add LKG
//     { "classId": "GRADE_10_ID", "sectionId": "SEC_A_ID" }, // Logic: Remove 10-A
//     { "classId": "GRADE_5_ID", "sectionId": "SEC_B_ID" }   // Logic: Add 5-B
//   ]
// }

export const getAllClassesWithSections = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { schoolId } = req.query;

    if (!schoolId) {
      return res.status(400).json({ ok: false, message: "schoolId is required" });
    }

    // 1. Fetch all Classes for the school
    // We use .lean() to get plain JS objects (faster/easier to modify)
    const classes = await ClassModel.find({ schoolId })
      .select("name hasSections _id") // specific fields you need
      .sort({ name: 1 }) // Sort classes alphabetically or by custom order
      .lean();

    if (!classes.length) {
      return res.status(200).json({ ok: true, data: [] });
    }

    // 2. Fetch all Sections associated with these classes
    // We filter by the IDs of the classes we just found
    const classIds = classes.map((c) => c._id);

    const sections = await SectionModel.find({ classId: { $in: classIds } })
      .select("name classId _id")
      .sort({ name: 1 }) // Sort sections (A, B, C...)
      .lean();

    // 3. Merge Sections into their respective Classes
    const data = classes.map((cls) => {
      // Find sections that belong to this class
      const classSections = sections.filter(
        (sec) => sec.classId.toString() === cls._id.toString()
      );

      return {
        _id: cls._id,
        name: cls.name,
        hasSections: cls.hasSections,
        // If class has sections, attach them. If not, empty array.
        sections: classSections
      };
    });

    return res.status(200).json({
      ok: true,
      data: data
    });

  } catch (error: any) {
    console.error("Get All Classes Error:", error);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
};