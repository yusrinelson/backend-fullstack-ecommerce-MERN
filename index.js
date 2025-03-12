require('dotenv').config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken")
const multer = require("multer")
const path = require("path")
const cors = require("cors");
// const { type } = require("os");

app.use(express.json());
app.use(cors());

console.log("MONGODB_URI:", process.env.MONGODB_URI);
console.log("JWT_SECRET:", process.env.JWT_SECRET);
console.log("PORT:", process.env.PORT);
//Database connection with mongodb
mongoose.connect(process.env.MONGODB_URI);
// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;
// Server Port
const port = process.env.PORT || 4000;



//Api creation
app.get("/", (req, res) => {
    res.send("Express App is now running")
})

//image storage engine
const storage = multer.diskStorage({
    destination: "./upload/images",
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})
//creating uplload endpoint for images
app.use("/images", express.static("upload/images"))
app.post("/upload", upload.single("product"), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

//schema for creating products
const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required:true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,  
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    }
})

// creating api for add product 

app.post("/addproduct", async(req, res) => {
    let products = await Product.find({});
    let id;
    if(products.length > 0) {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id  + 1;
    } else{
        id = 1;
    }

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    })
    console.log(product);
    await product.save();
    console.log("Saved")
    res.json({
        success: true,
        name: req.body.name,
    })
})

// creating api for add product 
app.post("/removeproduct", async(req, res) => {
    await Product.findOneAndDelete({id: req.body.id});
    console.log("Removed");
    res.json({
        success: true,
        name: req.body.name,
    })
}) 

//creating api for get all products
app.get("/allproducts", async(req, res) => {
    let products = await Product.find({});
        console.log("All product Fetched");
        res.send(products);
})

//schema for user model
const User = mongoose.model("User", {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Object,
    },
    date:{
        type:Date,
        default: Date.now,
    },
})

//Creating endpoint for registration
app.post("/signup", async(req, res) => {
    let check = await User.findOne({email: req.body.email});
    if(check){
        return res.status(400).json({success: false, errors: "Existing user found with same email address"})
    }
    let cart = {};
    for (let i=0; i < 300; i++){
        cart[i] = 0;
    }
    const user = new User({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })
    await user.save();

    const data = {
        user: {
            id: user.id
        }
    }
    const token = jwt.sign(data, JWT_SECRET);
    res.json({success: true, token})
})

//creating endpoint for use login
app.post("/login", async(req, res) => {
    let user = await User.findOne({email:req.body.email});
        if(user){
            const passMatch = req.body.password === user.password;
            if(passMatch){
                const data = {
                    user: {
                        id: user.id
                    }
                }
                const token = jwt.sign(data, JWT_SECRET);
                res.json({success: true, token});
            } else{
                res.json({success: false, errors: 'wrong Password'});
            }
        } else {
            res.json({success: false, errors: 'wrong Email'})
        }
})

//creating endpoint for Latest products

app.get("/newcollections", async(req, res) => {
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("NewCollection Fetched");
    res.send(newcollection);
})

//creating endpoint for popular products 
app.get("/popular", async(req, res) => {
    let products = await Product.find({category: "men"});
    let popular = products.slice(0, 4);
    console.log("Popular Fetched");
    res.send(popular);
})


//creating middlewear to fetch user 
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors: "Please authenticate using a valid ;login"});
    }else{
        try{
            const data = jwt.verify(token, JWT_SECRET);
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({errors: "Please authenticate using a valid token"});
        }
    }
}

//creating endpoint for adding products in cartdata
app.post("/addtocart", fetchUser, async(req, res) => {
    console.log("added", req.body, req.user);
    let userData = await User.findOne({_id: req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await User.findOneAndUpdate({_id: req.user.id}, {cartData: userData.cartData});
    res.send({success: true, message: "Added"});
})

//creating endpoint for removing products from cartdata
app.post("/removefromcart", fetchUser, async(req, res) => {
    console.log("removed", req.body, req.user);
    let userData = await User.findOne({_id: req.user.id});
    if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
    await User.findOneAndUpdate({_id: req.user.id}, {cartData: userData.cartData});
    res.send({success: true, message: "Removed"});
});


//creating endpoint to get cart data
app.post('/getcart', fetchUser, async(req, res) => {
    console.log("Get cart");
    let userData = await User.findOne({_id: req.user.id});
    res.json(userData.cartData);
})


app.listen(port, (error) => {
    if(!error){
        console.log("Server is running on " + port);
    }else{
        console.log("Error: " + error);
    }
})