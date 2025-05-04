const Post = require('../models/Post');
const UserProfile = require('../models/UserProfile');
const userProfile=require('../models/UserProfile');
// Create a new post
exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content && !req.file) {
      return res.status(400).json({ message: 'Content or media is required' });
    }

    let mediaUrl = null;
    let mediaType = null;
    
    if (req.file) {
      mediaUrl = `${req.protocol}://${req.get('host')}/uploads/posts/${req.file.filename}`;
      mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    }

    const post = new Post({
      user: userId,
      content,
      image: mediaUrl, // Store the media URL in the image field
      // mediaUrl,
      // mediaType
    });

    await post.save();
    res.status(201).json({ message: 'Post created successfully', post });
  } catch (error) {
    console.error('Error in createPost:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all posts created by the logged-in user
exports.getAllPosts = async (req, res) => {
  try {
    const userId = req.user.id; // Get the logged-in user's ID
    const [posts, userProfileData] = await Promise.all([
      Post.find({ user: userId })
        .populate('user', 'firstName surname')
        .sort({ createdAt: -1 }),
      userProfile.findOne({ user: userId })
    ]);

    // Add profile data to each post
    const postsWithProfile = posts.map(post => ({
      ...post.toObject(), // Convert Mongoose document to plain object
      userProfile: userProfileData ? userProfileData.toObject() : null
    })); 
    res.status(200).json(postsWithProfile);
  } catch (error) {
    console.error('Error in getAllPosts:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all posts (for news feed)
exports.getAllPostsFeed = async (req, res) => {
  try {
    const [posts, profiles] = await Promise.all([
      Post.find()
        .populate('user', 'firstName surname')
        .sort({ createdAt: -1 }),
      UserProfile.find()
    ]);

    const profileMap = new Map();
    profiles.forEach(profile => {
      profileMap.set(profile.user.toString(), profile);
    });

    const postsWithProfiles = posts.map(post => ({
      ...post.toObject(),
      userProfile: profileMap.get(post.user._id.toString()) || null
    }));

    res.status(200).json(postsWithProfiles);
  } catch (error) {
    console.error('Error in getAllPostsFeed:', error.message);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
    });
  }
};

// Like a post
exports.likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.likes.includes(userId)) {
      // Unlike the post if already liked
      post.likes = post.likes.filter((like) => like.toString() !== userId);
    } else {
      // Like the post
      post.likes.push(userId);
    }

    await post.save();
    res.status(200).json({ message: 'Post updated successfully', likes: post.likes.length });
  } catch (error) {
    console.error('Error in likePost:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    const { text } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = {
      user: userId,
      text
    };

    post.comments.push(comment);
    await post.save();

    res.status(201).json({ message: 'Comment added successfully', comments: post.comments });
  } catch (error) {
    console.error('Error in addComment:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};