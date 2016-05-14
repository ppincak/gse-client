var gulp, concat, babel;

gulp = require("gulp");
concat = require("gulp-concat");
babel = require("gulp-babel");

gulp.task("dist", function() {
    return gulp
        .src(["src/gse.js"])
        //.pipe(concat("gse.js"))
        .pipe(babel({
            presets: ["es2015"]
        }))
       // .pipe(uglify())
        .pipe(gulp.dest("dist"));
});