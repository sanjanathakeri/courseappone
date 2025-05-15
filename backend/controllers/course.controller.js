import { Course } from "../models/course.model.js";
import { v2 as cloudinary } from "cloudinary";
import { Purchase } from "../models/purchase.model.js";
import Stripe from "stripe";
import config from "../config.js";

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

// Create Course
export const createCourse = async (req, res) => {
  const adminId = req.adminId;
  const { title, description, price } = req.body;

  try {
    if (!title || !description || !price) {
      return res.status(400).json({ errors: "All fields are required" });
    }

    const { image } = req.files;
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ errors: "No file uploaded" });
    }

    const allowedFormat = ["image/png", "image/jpeg"];
    if (!allowedFormat.includes(image.mimetype)) {
      return res.status(400).json({ errors: "Only PNG and JPG are allowed" });
    }

    const cloud_response = await cloudinary.uploader.upload(image.tempFilePath);
    if (!cloud_response || cloud_response.error) {
      return res.status(400).json({ errors: "Error uploading to Cloudinary" });
    }

    const course = await Course.create({
      title,
      description,
      price,
      image: {
        public_id: cloud_response.public_id,
        url: cloud_response.url,
      },
      creatorId: adminId,
    });

    res.json({ message: "Course created successfully", course });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error creating course" });
  }
};

// Update Course (Fixed version)
export const updateCourse = async (req, res) => {
  const adminId = req.adminId;
  const { courseId } = req.params;
  const { title, description, price } = req.body;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ errors: "Course not found" });
    }

    let updatedImage = course.image;

    // Check if new image file is uploaded
    if (req.files && req.files.imageUrl) {
      const imageFile = req.files.imageUrl;

      const allowedFormat = ["image/png", "image/jpeg"];
      if (!allowedFormat.includes(imageFile.mimetype)) {
        return res.status(400).json({
          errors: "Invalid file format. Only PNG and JPG are allowed",
        });
      }

      // Upload new image
      const cloud_response = await cloudinary.uploader.upload(
        imageFile.tempFilePath
      );
      if (!cloud_response || cloud_response.error) {
        return res
          .status(400)
          .json({ errors: "Error uploading file to cloudinary" });
      }

      updatedImage = {
        public_id: cloud_response.public_id,
        url: cloud_response.url,
      };
    }

    // Update course details
    const updatedCourse = await Course.findOneAndUpdate(
      { _id: courseId, creatorId: adminId },
      { title, description, price, image: updatedImage },
      { new: true }
    );

    if (!updatedCourse) {
      return res
        .status(404)
        .json({ errors: "Can't update, created by another admin" });
    }

    res.status(200).json({ message: "Course updated successfully", course: updatedCourse });
  } catch (error) {
    console.error("Error updating course", error);
    res.status(500).json({ errors: "Error in course updating" });
  }
};

// Delete Course
export const deleteCourse = async (req, res) => {
  const adminId = req.adminId;
  const { courseId } = req.params;

  try {
    const course = await Course.findOneAndDelete({
      _id: courseId,
      creatorId: adminId,
    });

    if (!course) {
      return res
        .status(404)
        .json({ errors: "Can't delete, created by another admin" });
    }

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    res.status(500).json({ errors: "Error in course deleting" });
    console.log("Error in course deleting", error);
  }
};

// Get All Courses
export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find({});
    res.status(201).json({ courses });
  } catch (error) {
    res.status(500).json({ errors: "Error in getting courses" });
    console.log("Error getting courses", error);
  }
};

// Get Course Details
export const courseDetails = async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.status(200).json({ course });
  } catch (error) {
    res.status(500).json({ errors: "Error in getting course details" });
    console.log("Error in course details", error);
  }
};

// Buy Course
export const buyCourses = async (req, res) => {
  const { userId } = req;
  const { courseId } = req.params;

  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ errors: "Course not found" });
    }

    const existingPurchase = await Purchase.findOne({ userId, courseId });
    if (existingPurchase) {
      return res
        .status(400)
        .json({ errors: "User has already purchased this course" });
    }

    const amount = course.price;
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.status(201).json({
      message: "Course purchase initiated",
      course,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({ errors: "Error in course buying" });
    console.log("Error in course buying", error);
  }
};
