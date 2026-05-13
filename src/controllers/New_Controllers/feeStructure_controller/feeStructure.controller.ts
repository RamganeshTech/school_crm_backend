import type { Response } from "express";
import FeeStructureModel from "../../../models/New_Model/FeeStructureModel/FeeStructure.model.js";
import type { RoleBasedRequest } from "../../../utils/types.js";
// import { createAuditLog } from "../audit_controllers/audit.controllers.js";
// import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";
import { createAuditLog } from "../audit_controllers/audit.controllers.js";
import { archiveData } from "../deleteArchieve_controller/deleteArchieve.controller.js";

// ==========================================
// SET / UPDATE FEE STRUCTURE
// ==========================================
export const setFeeStructure = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { schoolId, classId, feeHead, type } = req.body;

    // 1. Basic Validation
    if (!schoolId || !classId || !feeHead) {
      return res.status(400).json({ ok: false, message: "schoolId, classId, and feeHead are required" });
    }

    if (!type || (type !== "old" && type !== "new")) {
      return res.status(400).json({
        ok: false,
        message: "type is required, it should be either new or old only"
      });
    }


    // // 2. Validate Class Exists
    // const classDoc = await ClassModel.findById(classId);
    // if (!classDoc) {
    //   return res.status(404).json({ ok: false, message: "Class not found" });
    // }

    // 3. Auto-Calculate Total Amount
    // This sums up all the values inside feeHead
    // const totalAmount = Object.values(feeHead).reduce((acc, val) => acc + (Number(val) || 0), 0);



    // 1. Calculate Total Academic Fee
    // Rule: Total = Admission + 1st Term + 2nd Term
    const totalAcademicFee =
      (Number(feeHead.admissionFee) || 0) +
      (Number(feeHead.firstTermAmt) || 0) +
      (Number(feeHead.secondTermAmt) || 0) +
      (Number(feeHead.busFirstTermAmt) || 0) +
      (Number(feeHead.busSecondTermAmt) || 0);



    // 4. Upsert (Update if exists, Create if new)
    // Filter: find by schoolId AND classId
    const updatedFee = await FeeStructureModel.findOneAndUpdate(
      { schoolId, classId, type, },
      {
        $set: {
          feeHead: {
            admissionFee: feeHead.admissionFee,
            firstTermAmt: feeHead.firstTermAmt,
            secondTermAmt: feeHead.secondTermAmt,
            busFirstTermAmt: feeHead.busFirstTermAmt,
            busSecondTermAmt: feeHead.busSecondTermAmt
          },
          totalAmount: totalAcademicFee,
          type: type
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    await createAuditLog(req, {
      action: "create",
      module: "fee_structure",
      targetId: updatedFee._id,
      description: `fee structure of this id got updated (${updatedFee._id})`,
      status: "success"
    });

    return res.status(200).json({
      ok: true,
      message: `Fee structure updated successfully`,
      data: updatedFee
    });

  } catch (error: any) {
    console.error("Set Fee Error:", error);
    return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
  }
};

// ==========================================
// GET FEE STRUCTURE (By Class)
// ==========================================
export const getFeeStructureByClass = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { schoolId, classId } = req.query;

    if (!schoolId || !classId) {
      return res.status(400).json({ ok: false, message: "schoolId and classId are required" });
    }

    const feeStructure = await FeeStructureModel.find({ schoolId, classId });

    if (!feeStructure) {
      // If no structure exists, return 0s so frontend doesn't break
      // This is better than a 404 error for the UI
      return res.status(200).json({
        ok: true,
        message: "No fee structure found, returning default",
        data: {
          type: null,
          feeHead: {
            admissionFee: 0,
            firstTermAmt: 0,
            secondTermAmt: 0,
            annualFee: 0,
            busFirstTermAmt: 0,
            busSecondTermAmt: 0
          },
          totalAmount: 0
        }
      });
    }

    return res.status(200).json({
      ok: true,
      message: "fetchedd fee structure for class",
      data: feeStructure
    });

  } catch (error: any) {
    console.error("Get Fee Error:", error);
    return res.status(500).json({ ok: false, message: "Internal server error" });
  }
};



export const getFeeStructure = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { schoolId } = req.query;

    if (!schoolId) {
      return res.status(400).json({ ok: false, message: "schoolId are required" });
    }

    const feeStructure = await FeeStructureModel.find({ schoolId });


    return res.status(200).json({
      ok: true,
      message: "fetchedd fee structure for all class",
      data: feeStructure
    });

  } catch (error: any) {
    console.error("Get Fee Error:", error);
    return res.status(500).json({ ok: false, message: "Internal server error", error: error?.message });
  }
};



export const deleteFeeStructure = async (req: RoleBasedRequest, res: Response) => {
  try {
    const { id } = req.params;


    const updatedFee:any = await FeeStructureModel.findByIdAndDelete(
      id
    );




    await archiveData({
      schoolId: updatedFee.schoolId,
      category: "student fee record",
      originalId: updatedFee._id,
      deletedData: updatedFee.toObject(), // Convert Mongoose doc to plain object
      deletedBy: req.user!._id || null,
      reason: null, // Optional reason from body
    });


    return res.status(200).json({
      ok: true,
      message: `Fee structure deleted successfully`,
      data: updatedFee
    });

  } catch (error: any) {
    console.error("Set Fee Error:", error);
    return res.status(500).json({ ok: false, message: "Internal server error", error: error.message });
  }
};
