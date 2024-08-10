import express from "express";
import bodyParser from "body-parser";   
import { dirname, join } from "path";             
import { fileURLToPath } from "url"; 
import axios from "axios";       
import pg from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from 'passport-google-oauth2';


const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));
app.use(express.static(join(__dirname, '/public/css')));
app.use(express.static(join(__dirname, '/public/icons')));

// View engine olarak EJS ayarlama
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
dotenv.config();

app.use(session({
    secret: process.env.SECRET_KEY,  //ENV'e ekle
    resave: false,
    saveUninitialized: true,
    cookie:{
        maxAge: 1000*60*60*24
    }
}));

app.use(passport.initialize());
app.use(passport.session());



const db = new pg.Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT
});

async function connectDB(){
    try{
        await db.connect();
        console.log(`Connected to the DB.`);
    }
    catch(err){
        console.log(`Couldn't connect to the DB. ${err}`);
    }
}

connectDB();


async function getQuery(query, params){
    try{
        const result = await db.query(query, params);
        console.log("Query has successfully been sent.");
        return result;
    }

    catch(err){
        console.log(`Query couldn't have been sent. ${err}`);
    }
}


function sendGet(page_path, file){
    app.get(page_path, (req , res)=>{
        res.render(file);
    });
};

sendGet("/", `index.ejs`);
sendGet("/login", `login.ejs`);
sendGet("/register", `register.ejs`);
sendGet("/resetpass", `resetpass.ejs`);

app.get("/secrets",(req , res)=>{
    if(req.isAuthenticated()){
        console.log(req.isAuthenticated());
        res.render(`${__dirname}/views/secrets.ejs`,{
            name: req.user.name
        }); 
    }
    else{
        console.log(req.isAuthenticated());
        res.redirect(`/login`);
    }
});

app.post("/secrets",(req , res)=>{
    const button = req.body.button;
    if(button === "logout"){
        // res.redirect("/");
        req.logout((err)=>{
            if(err){
                console.log(`Error while logging out. ${err}`);
                res.send("Error occured while logging out.");
            }
            res.redirect("/");
        });
    }
    else if(button === "submit_secret"){
        res.redirect("/submit");
    }
});


let secret_arr = [];
let secret_arr2 = [];
app.get("/submit", async (req , res)=>{
    if(req.isAuthenticated()){
        const email_user = req.user.email;
        const JSON_format_secrets = await getQuery("SELECT * FROM secrets WHERE email_user = ($1)", [email_user]);
        const JSON_format_credentials = await getQuery("SELECT * FROM users WHERE email = ($1)", [email_user]);
        const user_db = JSON_format_credentials.rows[0].email;
        const secrets_db = JSON_format_secrets.rows;
       
        for(let i=0;i<secrets_db.length;i++){
            secret_arr.push(secrets_db[i].secret);
        }

        res.render(`${__dirname}/views/submit.ejs`,{
            secrets: secret_arr
        });
        secret_arr2 = secret_arr;
        secret_arr = [];
    }
    else{
        res.redirect("/login");
    }
});





app.post("/submit", async (req, res) => {
    const button = req.body.button;
    const input_value = req.body.secret_input;
    const index = req.body.index;
    const email_user = req.user.email;
    console.log("Email entered: " +req.user.email);  

    if (button === "submit-btn") {
        if (input_value !== "" && input_value[0] !== " ") { // ADDS ALL SECRETS THE USER HAS EVER INSERTED
            await getQuery("INSERT INTO secrets (secret, email_user) VALUES ($1, $2);",[input_value, email_user]);
            secret_arr2.push(input_value);
        }
    } 
    
    else if (button === "clear-btn") {  // DELETES ALL SECRETS THE USER HAD
            await getQuery("DELETE FROM secrets WHERE email_user = $1;",[req.user.email]);
            secret_arr2 = [];
            console.log(`Deleted the arr: ${secret_arr2}`);
        
    } 

    else if (button === "delete-btn") { //DELETES SECRETS CLICKING ON X BUTTON 
        if (index !== undefined && index >= 0 && index < secret_arr2.length) {
        const email_user = req.user.email;
        const JSON_format_secrets = await getQuery(`SELECT * FROM secrets WHERE email_user = ($1)`, [email_user]);
        const user_secrets = JSON_format_secrets.rows;
        console.log("USER SECRETS: "+user_secrets);

        console.log("HERŞEYDEN ÖNCE " + secret_arr2);

        
        const deleted_secret = secret_arr2[index];

        console.log(`Email user is ${email_user} and the secret will be deleted is ${deleted_secret}`);


        await getQuery("DELETE FROM secrets WHERE email_user = ($1) and secret = ($2);", [email_user, deleted_secret]);
        secret_arr2.splice(index, 1);
        console.log(`Deleted the arr: ${secret_arr2}`);
    }

    }
    res.redirect("/submit");
    // console.clear();
});


app.get("/auth/google/login", passport.authenticate("google",{
    scope: ["profile", "email"]
}));

app.get("/auth/google/register", passport.authenticate("google",{
    scope: ["profile", "email"]
}));


app.get("/auth/google/secrets",passport.authenticate("google",{
    successRedirect: "/secrets",
    failureRedirect: "/login"
}));

const saltRounds = 10;

app.post("/",(req , res)=>{
    const button = req.body.button;
    if(button === "register"){
        res.redirect("/register");
    }
    else if(button === "login"){
        res.redirect("/login");
    }
});


app.post("/register", async (req , res)=>{
    const name = req.body.name;
    const surname = req.body.surname;
    const email = req.body.email;
    const password = req.body.password;
    const day = req.body.birthday;
    const month = req.body.birthmonth;
    const year = req.body.birthyear;
    const gender = req.body.gender;

    const hashed_password = await bcrypt.hash(password, saltRounds);
    

    console.log(`
        Name: ${name}
        Surname: ${surname}
        Email: ${email}
        Password: ${password}
        Hashed Password: ${hashed_password}
        Birthday: ${day}
        Birthmonth: ${month}
        Birthyear: ${year}
        Gender: ${gender}
        `);

        await getQuery("INSERT INTO users (name, surname, email, password, day, month, year, gender) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);", [name, surname, email, hashed_password, day, month, year, gender]);


        res.send(`<h1>Successfully Registered :)) WELCOME, ${name}</h1>`);

});


app.post("/login", passport.authenticate("local",{
    successRedirect: "/secrets",
    failureRedirect: "/login"
}));


//Works amazingly good. Don't come back down here.
app.post("/resetpass", async (req , res)=>{
    const email = req.body.email;
    const password = req.body.currentpass;
    const new_password = req.body.newpassword;
    const confirm_password = req.body.confirmpass;

    const JSON_format = await getQuery(`SELECT * FROM users WHERE email = ($1)`, [email]);
    const user_data = JSON_format.rows;
 
    if(user_data.length > 0){
        const password_db = user_data[0].password;

         //If the password entered is correct, returns true
         let isPasswordCorrect = await bcrypt.compare(password, password_db);

        if(isPasswordCorrect === true){

            if(new_password === confirm_password){
                const new_hashed_password = await bcrypt.hash(new_password, saltRounds);
                await getQuery(`UPDATE users SET password = ($1) WHERE email = ($2);`,[new_hashed_password, email]);
                res.send("<h1>Your password has successfully been changed :))</h1>");
            }
            else{
                res.send("<h1>Confirm your new password correctly!!!</h1>");
            }
        
           }

        else{
            res.send("<h1>Wrong credentials to change the password !!!</h1>");
           }
    
    }

    else{
        res.send("<h1>User not found !!!</h1>");
    }

});


passport.use(new LocalStrategy({usernameField: 'email',passwordField: 'password'}, async (email, password, cb) => {
    console.log("GOT INNN!!");
    const JSON_format = await getQuery(`SELECT * FROM users WHERE email = ($1);`, [email]); 
    const user_data = JSON_format.rows[0];
    console.log(JSON_format.rows);

    try{

        if(JSON_format.rows != ""){
            const password_db = user_data.password;
            await bcrypt.compare(password, password_db, (err, result)=>{
                 if(err){
                     console.log(err);
                     return cb(err);
                 }
                 else if(result){
                     return cb(null, user_data);  //isAuthenticated() is currently activated.
                 }
                 else if(!result){
                     return cb(null, false);
                 }
             });
        }
        else{
            return cb("USER NOT FOUND!!");
        }

    }

    catch(err){
        console.log(err);
    }
   
       
}));

let counter = 0;
passport.use("google",new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
}, async (accessToken, refreshToken, profile, cb)=>{

    console.log(profile);
    try{
        const JSON_format = await getQuery(`SELECT * FROM users WHERE email = ($1)`,[profile.email]);
        const db_result = JSON_format.rows;
        if(db_result.length === 0){
            console.log("User doesn't exist. But i saved it tho.");
                const new_user = await getQuery("INSERT INTO users (name, surname, email, password) VALUES ($1, $2, $3, $4);", [profile.given_name, profile.family_name, profile.email, 'google password']);
                cb(null, new_user.rows[0]);
        }
        else{
            //Already existing user
            console.log("User exists.");
             cb(null, db_result[0]);
        }

    }
    catch(err){
         cb(err);
    }

}));




passport.serializeUser((user_data, cb)=>{
     cb(null, user_data);
});

passport.deserializeUser((user_data, cb)=>{
     cb(null, user_data);
});


const port = 3000;
app.listen(port, () => {
    console.log(`Listening on port ${port}...`);
});
