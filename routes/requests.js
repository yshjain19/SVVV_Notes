const router = require("express").Router();
const catchAsync = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};
const requests = require("../controllers/requests");
const { isLoggedIn, createRequestLimiter } = require("../middleware");

// Collection routes
router
  .route("/")
  .get(catchAsync(requests.index))
  .post(isLoggedIn, createRequestLimiter, catchAsync(requests.create));

router.get("/new", isLoggedIn, requests.renderNewForm);

// Item routes
router
  .route("/:id")
  .get(catchAsync(requests.show))
  .delete(isLoggedIn, catchAsync(requests.destroy));

router.post("/:id/fulfill", isLoggedIn, catchAsync(requests.fulfill));

module.exports = router;
