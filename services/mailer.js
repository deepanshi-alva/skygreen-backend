"use strict";

const compile = require("lodash/template"); // safer & faster than pulling full lodash

module.exports = {
  async sendWelcomeEmail(user, options = {}) {
    // console.log("--- Send Welcome Email called ---", user, options);
    const reset_base_url =
      options.reset_base_url || process.env.RESET_PASSWORD_URL;
    try {
      if (!user?.email) {
        strapi.log.warn("No user.email provided to sendWelcomeEmail");
        return { ok: false };
      }
      // 1) Fetch WELCOME template (Strapi v5 Document Service API)
      const welcomeTemplate = await strapi
        .query("api::message-template.message-template")
        .findFirst({
          filters: { email_type: "WELCOME" },
          fields: ["subject", "message"]
        });

      if (!welcomeTemplate) {
        strapi.log.warn("Welcome email template not found");
        return { ok: false };
      }
      // 2) Normalize rich-text "message" (if stored as Slate-like blocks) -> plain text
      const blocks = Array.isArray(welcomeTemplate.message)
        ? welcomeTemplate.message
        : [];
      const rawMessage =
        blocks.length > 0
          ? blocks
              .map((p) =>
                p?.type === "paragraph"
                  ? (p.children || []).map((c) => c?.text || "").join("")
                  : ""
              )
              .join("\n\n")
          : String(welcomeTemplate.message ?? "");

      // 3) (Optional) Issue short-lived JWT for resetLink only if base URL exists
      let resetLink = "";
      if (reset_base_url) {
        try {
          const jwtService = strapi.service("plugin::users-permissions.jwt");
          const token = await jwtService.issue(
            { id: user.id, email: user.email },
            { expiresIn: "1d" }
          );
          resetLink = `${reset_base_url}?token=${encodeURIComponent(token)}`;
        } catch (e) {
          strapi.log.warn(`Could not issue reset token: ${e.message}`);
        }
      } else {
        strapi.log.debug(
          "RESET_PASSWORD_URL not set; no resetLink will be included."
        );
      }

      // 4) Build placeholder bag
      const roleName = user?.role?.name || user?.roleName || user?.role || "";
      const placeholders = {
        id: user.id ?? "",
        username: user.username ?? "",
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        email: user.email ?? "",
        roleName,
        resetLink,
      };

      // 5) Compile subject + message with lodash.template (supports <%= var %>)
      const subjectTpl = compile(
        welcomeTemplate.subject || "Welcome, <%= firstName %>!"
      );
      const bodyTpl = compile(
        rawMessage || "Hi <%= firstName %>, welcome aboard!"
      );

      const subject = subjectTpl(placeholders);
      const htmlBody = bodyTpl(placeholders)
        // If your template is plain text, convert newlines to <br> for HTML delivery
        .replace(/\n/g, "<br/>");

      // 6) Send via Email plugin (use provider defaults for from/replyTo if configured)
      await strapi.plugin("email").service("email").send({
        to: user.email,
        subject,
        html: htmlBody,
        // text: Optional — generate a plain text version if you keep HTML in DB
        // from: process.env.EMAIL_ADDRESS, // usually omit; use plugin defaultFrom
      });

      strapi.log.info(`✅ Welcome email sent to ${user.email}`);
      return { ok: true };
    } catch (err) {
      strapi.log.error("❌ Error preparing/sending welcome email:", err);
      return { ok: false };
    }
  },
  // async sendInductionCoursesEnrollmentEmail(user) {
  //   const template = await strapi.db
  //     .query("api::message-template.message-template")
  //     .findOne({
  //       where: { email_type: "INDUCTION_COURSES" },
  //     });

  //   if (!template) {
  //     strapi.log.warn("Induction email template not found");
  //     return { ok: false };
  //   }
  //   // console.log("template", template);
  //   try {
  //     // Fetch the courses using the `findCoursesByCategoryAndFilters` function
  //     const { data: inductionCourses } = await findCoursesByCategoryAndFilters({
  //       category_titles: ["Full Stack Web Development"],
  //       department_ids: user?.location?.documentId || "",
  //       location_ids: user?.location?.documentId || "",
  //       role_name: user?.role?.name || "",
  //     });

  //     // Create enrollments for each course
  //     await createEnrollments(
  //       (inductionCourses || [])?.map((c) => c?.documentId),
  //       user?.id
  //     );

  //     // Generate and send the email content using the courses data and template
  //     await generateEmailContent(user, inductionCourses, template);

  //     return { ok: true };
  //   } catch (error) {
  //     strapi.log.error(
  //       "❌ Error preparing/sending Induction Courses Enrollment email:",
  //       error
  //     );
  //     return { ok: false };
  //   }
  // },
};

// async function findCoursesByCategoryAndFilters(params = {}) {
//   try {
//     const {
//       category_titles,
//       department_ids = null,
//       location_ids = null,
//       role_name = null,
//     } = params;

//     // Validate that category_titles is an array
//     if (!Array.isArray(category_titles) || category_titles.length === 0) {
//       throw new Error(
//         "category_titles (array of category titles) is required."
//       );
//     }

//     // Common populate (adjust as needed)
//     const populate = {
//       courses_categories: { fields: ["title", "documentId"] },
//       departments: { fields: ["title", "documentId"] },
//       locations: { fields: ["title", "documentId"] },
//       roles: true,
//       instructors: { fields: ["username", "email", "id"] },
//     };

//     const queryAOpts = {
//       filters: {
//         courses_categories: { title: { $in: category_titles } },
//       },
//       populate,
//     };

//     const allCourses = await strapi
//       .documents("api::course.course")
//       .findMany(queryAOpts);

//     const filteredCourses = allCourses.filter((course) => {
//       // Department check
//       const hasMatchingDepartment =
//         (course?.departments || []).length === 0
//           ? true // Available to all users if no department filter
//           : (course?.departments || [])?.some(
//               (item) => department_ids === item.documentId
//             );

//       // Location check
//       const hasMatchingLocation =
//         (course?.locations || []).length === 0
//           ? true // Available to all users if no location filter
//           : (course?.locations || [])?.some(
//               (item) => location_ids === item.documentId
//             );

//       // Role check
//       const hasMatchingRole =
//         (course?.roles || []).length === 0
//           ? true // Available to all users if no role filter
//           : (course?.roles || [])?.some(
//               (item) => role_name.toLowerCase() === item.name.toLowerCase()
//             );

//       // Return true if all the filters match (or no filters are required)
//       return hasMatchingDepartment && hasMatchingLocation && hasMatchingRole;
//     });

//     // Return the merged courses without pagination
//     return {
//       data: filteredCourses,
//       meta: {
//         count: filteredCourses.length,
//       },
//     };
//   } catch (error) {
//     console.error("Error fetching courses by category and filters:", error);
//     throw new Error("An error occurred while fetching the courses.");
//   }
// }

// async function generateEmailContent(user, courses, template) {
//   try {
//     const sanitizedCourses = Array.isArray(courses)
//       ? courses.filter(Boolean).map((c) => ({
//           title: String(c?.title || "").trim(),
//           link: String(
//             `${process.env.NEXT_PUBLIC_DEPLOYED_SITE_URL}/course/video-course/${c?.documentId}` ||
//               ""
//           ),
//         }))
//       : [];

//     // console.log("sanitizedCourses", sanitizedCourses);

//     const rawMessage = (template.message || [])
//       .map((p) =>
//         p.type === "paragraph"
//           ? p.children.map((c) => c.text || "").join("")
//           : ""
//       )
//       .join("\n\n");

//     const roleName = user?.role?.name || user?.roleName || user?.role || "";
//     const placeholders = {
//       id: user.id ?? "",
//       username: user.username ?? "",
//       firstName: user.firstName ?? "",
//       lastName: user.lastName ?? "",
//       email: user.email ?? "",
//       role: roleName,
//       courses: sanitizedCourses,
//       dashboardLink: `${process.env.NE2wqXT_PUBLIC_DEPLOYED_SITE_URL}/public/user-dashboard`,
//     };

//     const bodyTpl = compile(
//       rawMessage || "Hi <%= firstName %>, welcome aboard!"
//     );

//     const htmlBody = bodyTpl(placeholders);

//     await strapi.plugin("email").service("email").send({
//       to: user.email,
//       subject: template?.subject,
//       html: htmlBody,
//     });
//     strapi.log.info(`✅ Induction Courses sent to ${user.email}`);
//     return { ok: true };
//   } catch (err) {
//     strapi.log.error("❌ Error preparing/sending Enrollment email:", err);
//     return { ok: false };
//   }
// }

// async function createEnrollments(courses, userId) {
//   try {
//     // Validate the courses array and userId
//     if (!Array.isArray(courses) || courses.length === 0) {
//       throw new Error("Courses array is required and should not be empty.");
//     }
//     if (!userId) {
//       throw new Error("User ID is required.");
//     }

//     const currentDate = new Date();

//     // Iterate over each course documentId and create an enrollment
//     const enrollmentsPromises = courses.map(async (courseId) => {
//       const enrollmentData = {
//         data: {
//           course: courseId, // Course document ID
//           user: userId, // User ID
//           startAt: currentDate.toISOString(), // Set startAt to current date
//           Course_Status: "In Progress", // Default status
//           progress: 0, // Default progress
//         },
//       };

//       // Create the enrollment using strapi.documents()
//       const enrollment = await strapi
//         .documents("api::course-enrollment.course-enrollment")
//         .create({
//           ...enrollmentData,
//           status: "published",
//         });
//       return enrollment;
//     });

//     // Wait for all enrollment promises to resolve
//     const enrollments = await Promise.all(enrollmentsPromises);

//     // console.log("enrollments", enrollments);

//     enrollments?.map(async (enrollment) => {
//       await handleAfterCreateLogic(enrollments?.documentId);
//     });

//     // Return the created enrollments
//     return {
//       data: enrollments,
//       meta: {
//         count: enrollments.length,
//       },
//     };
//   } catch (error) {
//     console.error("Error creating enrollments:", error);
//     throw new Error("An error occurred while creating enrollments.");
//   }
// }

// async function handleAfterCreateLogic(enrollmentId) {
//   const enrollment = await strapi
//     .documents("api::course-enrollment.course-enrollment")
//     .findOne({
//       documentId: enrollmentId,
//       status: "published", // Only fetch published documents
//       populate: {
//         user: true,
//         topicProgress: true,
//         course: {
//           populate: ["createdby"], // Use correct field name and case
//         },
//       },
//     });

//   console.log("enrollment data show is here", enrollment);

//   if (!enrollment || !enrollment?.course || !enrollment.user) {
//     console.warn("⚠️ Enrollment or course or user missing. Skipping...");
//     return;
//   }

//   const user = enrollment?.user;
//   const course = enrollment?.course;
//   const courseCreator = enrollment?.course?.createdby;

//   console.log("user data show is here", user, course, courseCreator);

//   try {
//     const master = await strapi.entityService.findOne(
//       "api::master-point.master-point",
//       1,
//       {
//         populate: {
//           Mandatory: true,
//           Recommended: true,
//           Elective: true,
//           Training_activities: true,
//         },
//       }
//     );

//     // console.log("course data", course);

//     const enrollmentPoints = !!course.course_mandatory
//       ? master.Mandatory.course_enrollment
//       : master.Elective.course_enrollment;

//     //1. points on course enrollment to user
//     await updateMultipleUserActivityFields(user?.id, [
//       {
//         field: "points_earned",
//         valueToAdd: enrollmentPoints,
//       },
//       {
//         field: "number_of_courses_enrolled",
//         valueToAdd: 1,
//       },
//     ]);
//     await recordUserActivityPoints(user?.id, [
//       {
//         category: !!course.course_mandatory ? "Mandatory" : "Elective",
//         activity: "course_enrollment",
//         points: !!course.course_mandatory
//           ? master.Mandatory.course_enrollment
//           : master.Elective.course_enrollment,
//         documentId: course.documentId,
//       },
//       {
//         category: !!course.course_mandatory ? "Mandatory" : "Elective",
//         activity: "number_of_courses_enrolled",
//         points: 1,
//       },
//     ]);
//     //2. points to course creator
//     if (!courseCreator) {
//       await updateMultipleUserActivityFields(
//         courseCreator?.id,
//         [
//           {
//             field: "points_achieved",
//             valueToAdd: master.Training_activities.course_enrolment,
//           },
//         ],
//         true
//       );
//       await recordUserActivityPoints(courseCreator?.id, [
//         {
//           category: "Training_activities",
//           activity: "course_enrollment",
//           points: master.Training_activities.course_enrolment,
//         },
//       ]);
//     }

//     console.log(
//       `✅ Added enrollment points in Create Lifecycle in handleAfterCreateLogic: ${enrollmentPoints}`
//     );
//   } catch (err) {
//     console.error(
//       "❌ Error awarding enrollment points in handleAfterCreateLogic:",
//       err
//     );
//   }
// }
