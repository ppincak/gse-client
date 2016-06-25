var gulp, babel, uglify, rename;

gulp = require("gulp");
babel = require("gulp-babel");
uglify = require('gulp-uglify');
rename = require('gulp-rename');

gulp.task("dist", function() {
    return gulp
        .src(["src/gse.js"])     
        .pipe(babel({
            presets: ["es2015"]
        }))
        .pipe(uglify())
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(gulp.dest("dist/"));
});