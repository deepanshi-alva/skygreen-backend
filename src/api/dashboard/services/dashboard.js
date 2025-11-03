// module.exports = {
//     async findNewEnrollments(limit, type, { user, UserRole }) {
//         if (UserRole === "ADMIN" && type === 'admin') {
//             try {
//                 const enrollments = await strapi.db.query('api::course-enrollment.course-enrollment').findMany({
//                     populate: {
//                         user: {
//                             populate: {
//                                 profileImage: {
//                                     fields: ['url'],
//                                 },
//                             },
//                             fields: ['firstName'],
//                         },
//                         course: {
//                             fields: ['title'],
//                         },
//                     },
//                     where: {
//                         publishedAt: { $notNull: true },
//                     },
//                     orderBy: { createdAt: 'desc' },
//                     limit: parseInt(limit, 10),
//                 });
//                 // console.log(JSON.stringify(enrollments[0], null, 2), "result is here xyz");
                

//                 const result = enrollments.map((enrollment, index) => ({
//                     order: index + 1,
//                     userProfileImage: enrollment.user?.profileImage?.url || '',
//                     username: enrollment.user?.username,
//                     firstName:enrollment.user?.firstName,
//                     lastName:enrollment.user?.lastName,
//                     latestCourse: enrollment.course?.title,
//                     createdAt: enrollment.createdAt
//                 }));

//                 return result;
//             } catch (error) {
//                 console.error('Error fetching new enrollments:', error);
//                 throw new Error('Error fetching new enrollments');
//             }
//         } else if (UserRole === 'Manager' ||  UserRole === 'INSTRUCTOR' || UserRole === "ADMIN" && type === 'manager') {
//             try {
//                 const enrollments = await strapi.db.query('api::course-enrollment.course-enrollment').findMany({
//                     populate: {
//                         user: {
//                             populate: {
//                                 profileImage: {
//                                     fields: ['url'],
//                                 },
//                             },
//                             fields: ['firstName'],
//                         },
//                         course: {
//                             fields: ['title'],
//                         },
//                     },
//                     where: {
//                         publishedAt: { $notNull: true },
//                         course: {
                          
//                                 instructors: { id: user?.id },
                        
//                         },
//                     },
//                     orderBy: { createdAt: 'desc' },
//                     limit: parseInt(limit, 10),
//                 });
//                 const result = enrollments.map((enrollment, index) => ({
//                     order: index + 1,
//                     userProfileImage: enrollment.user?.profileImage?.url || '',
//                     username: enrollment.user?.username,
//                     firstName:enrollment.user?.firstName,
//                     lastName:enrollment.user?.lastName,
//                     latestCourse: enrollment.course?.title,
//                     createdAt: enrollment.createdAt
//                 }));

//                 return result;
//             } catch (error) {
//                 console.error('Error fetching new enrollments:', error);
//                 throw new Error('Error fetching new enrollments');
//             }
//         }
//     },
// };