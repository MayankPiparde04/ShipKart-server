/**
 * Get unique error field name
 */
const uniqueMessage = (error) => {
  let output;
  try {
    let fieldName = error.message.split(".$")[1];
    let field = fieldName.split(" dup key")[0];
    field = field.substring(0, field.lastIndexOf("_"));
    // req.flash legacy support or removal needed if req is not available here
    // Assuming this function is pure logic now or req is passed elsewhere

    output =
      fieldName.charAt(0).toUpperCase() +
      fieldName.slice(1) +
      " already exists";
  } catch (ex) {
    output = "already exists";
  }

  return output;
};

/**
 * Get the erroror message from error object
 */
export const errorHandler = (error) => {
  let message = "";

  if (error.code) {
    switch (error.code) {
      case 11000:
      case 11001:
        message = uniqueMessage(error);
        break;
      default:
        message = "Something went wrong";
    }
  } else {
    for (let errorName in error.errorors) {
      if (error.errorors[errorName].message)
        message = error.errorors[errorName].message;
    }
  }

  return message;
};
