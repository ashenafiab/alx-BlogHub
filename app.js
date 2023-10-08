const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const User = require("./model/user");

// Configure passport.js 
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const app = express();
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: "YourSecretKey",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const StartingAboutContent = "Welcome to ALX BlogHub! I'm Ashenafi Abebaw, a Cohort 9 ALX student. This is your hub for insightful articles on tech, innovation, and personal growth. Join me on this journey of learning and inspiration, and don't hesitate to get in touch through the links provided in the footer below.";

mongoose.connect("mongodb+srv://ashenafiabebaw02:kdNfSyUH7vHvMMNU@cluster0.o4bgfac.mongodb.net/blogDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("Connected to MongoDB");
}).catch((error) => {
  console.error(error);
});

const postSchema = mongoose.Schema({
  title: String,
  content: String,
  comments: [
    {
      user: String,
      text: String,
      upvotes: Number,
      downvotes: Number
    }
  ]
});

const Post = mongoose.model("Post", postSchema);

// Add a new route for displaying a single post
app.get('/posts/:id', async (req, res) => {
  const post = await Post.findById(req.params.id).populate('comments');
  const comments = post.comments; // Extract comments from the post object
  res.render('post', { post, comments, user: req.user }); // Pass the user object
});

// Middleware to make req available in EJS templates
app.use((req, res, next) => {
  res.locals.req = req; // Add req to res.locals
  res.locals.user = req.user; // Add req.user to res.locals
  next();
});

// Home route
app.get("/", async (req, res) => {
  try {
    const posts = await Post.find({});
    res.render("home", {
      posts: posts,
      user: req.user, // Pass the user object
      userInitial: res.locals.userInitial, // Pass the userInitial variable
    });
  } catch (error) {
    console.error(error);
    res.render("error-page");
  }
});

// Signup routes
app.get("/signup", (req, res) => {
  res.render("signup", {
    user: req.user, // Pass the user object
  });
});

app.post("/signup", async (req, res) => {
  try {
    const user = await User.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      username: req.body.username,
      password: req.body.password
    });
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.render("error-page");
  }
});

app.get("/login", function (req, res) {
  res.render("login", {
    user: req.user, // Pass the user object
    userInitial: res.locals.userInitial // Pass the userInitial variable
  });
});

// Handling user login
app.post("/login", async function (req, res) {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      const result = req.body.password === user.password;
      if (result) {
        // Correct password, redirect to home
        req.login(user, function (err) {
          if (err) {
            console.error(err);
            res.render("error-page");
          } else {
            req.session.isLoggedIn = true; // Set the session variable
            res.redirect("/");
          }
        });
      } else {
        res.status(400).json({ error: "Password doesn't match" });
      }
    } else {
      res.status(400).json({ error: "User doesn't exist" });
    }
  } catch (error) {
    res.status(400).json({ error });
  }
});


//Handling user logout 
app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      console.error(err);
      return res.render("error-page"); // Render an error page if logout fails
    }
    // Clear the session variable
    req.session.isLoggedIn = false; // Clear the session variable
    // If logout is successful, redirect to the home page or any other desired page
    res.redirect("/");
  });
});


// Compose route
app.get("/compose", (req, res) => {
  res.render("compose", {
    user: req.user, // Pass the user object
  });
});

app.post("/compose", async (req, res) => {
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody
  });

  try {
    await post.save();
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.render("error-page");
  }
});

// Post route
app.get("/posts/:postId", async (req, res) => {
  const requestedId = req.params.postId;

  try {
    const post = await Post.findById(requestedId);

    if (post) {
      res.render("post", {
        title: post.title,
        content: post.content,
        user: req.user, // Pass the user variable to the post.ejs template
        _id: post._id // Pass the _id variable to the post.ejs template
      });
    } else {
      res.render("post-not-found");
    }
  } catch (error) {
    console.error(error);
    res.render("error-page");
  }
});


// Add a new route for handling comment submission
app.post('/posts/:id/comments', async (req, res) => {
  const postId = req.params.id;
  const { user, text } = req.body;

  try {
    const post = await Post.findById(postId);
    post.comments.push({ user, text, upvotes: 0, downvotes: 0 });
    await post.save();
    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding comment');
  }
});

// Handle upvote requests
app.post('/posts/:postId/comments/:commentId/upvote', async (req, res) => {
  const postId = req.params.postId;
  const commentId = req.params.commentId;

  try {
    const post = await Post.findById(postId);
    const comment = post.comments.id(commentId);

    comment.upvotes += 1;
    await post.save();

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error(error);
    res.render('error-page');
  }
});

// Handle downvote requests
app.post('/posts/:postId/comments/:commentId/downvote', async (req, res) => {
  const postId = req.params.postId;
  const commentId = req.params.commentId;

  try {
    const post = await Post.findById(postId);
    const comment = post.comments.id(commentId);

    comment.downvotes += 1;
    await post.save();

    res.redirect(`/posts/${postId}`);
  } catch (error) {
    console.error(error);
    res.render('error-page');
  }
});

// About route
app.get("/about", (req, res) => {
  res.render("about", { StartingAbout: StartingAboutContent, user: req.user || null }); // Pass the user object or null if not defined
});

// Start the server
app.listen(3000, () => {
  console.log("Server started on port 3000");
});