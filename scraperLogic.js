/*
LUCA FULGA - May, 2023
This program uses a variety of functions that can be called 
from an HTML file to calculate a FIS penalty
*/

let racerScore;
const pointsIn10 = []
const pointsInRace = []
const rpoints = []
const times = []
const fFactorGS = 1010.0
const fFactorSL = 730.0


// this function aims to return all of the html code from livetiming as a string to be parsed
async function getLT() 
{
    let liveTimingHtml = null;
    let input = ""

    // retrieves the URL for the race
    input = document.getElementById("raceInput").value;

    alert( "Scraping Site : " + input);

    // modifies the URL to get the URL that livetiming accesses with all the data
    let liveTimingSite = "https://www.live-timing.com/includes/aj_race.php?r="
     + input.substring(input.length - 6) + "&&m=1&&u=5";
    
    // error testing
    console.log(liveTimingSite);

    // call fetch
    let liveTimingDoc = await fetch(liveTimingSite);

    // check response
    if( !liveTimingDoc )
    {
        alert("Failed to Connect to LiveTiming Web Site");
    } else {
        liveTimingHtml = await liveTimingDoc.text();
        if( !liveTimingHtml )
        {
            alert("Failed to Fetch LiveTiming HTML Data");
        }
    }

    // return the result from the fetch.text call
    return liveTimingHtml;
}

// calculates penalty
async function getPenalty() {
    
    // grab the HTML data from the liveTiming data site
    let liveTimingData = await getLT();
    
    // another error check
    if( !liveTimingData )
    {
        alert("Failed to Fetch LiveTiming HTML Data");
    } else {
        // initialize regular expressions that extracts the total time of each athlete
        let regex = /(?<=\|tt=)[\d:]+\.\d+/g;
        let match;
        // executes it and pushes into array
        while ((match = regex.exec(liveTimingData)) !== null){
            times.push(match[0]);
        }

        // fills the array with sorted times in seconds using function
        times.splice(0, times.length, ...timesToSeconds(times));

        /* regex for FIS points only if they actually participated in the race
        (didn't DNS)*/
        regex = /(?<=\|fp=)\d+(?=\|r1=\d{1}.{10,12}\|r2=\d{1})/g;
        while((match = regex.exec(liveTimingData)) !== null){
            pointsIn10.push(match[0]);
        }

        // this creates an object with the times and points arrays
        // this is basically a struct but in js they are objects and harder to use
        const combinedArr = times.map((tt, fp) => ({ tt, value: pointsIn10[fp] }));
        combinedArr.sort((a, b) => a.tt - b.tt);
        /* essentially I sorted the both arrays by fastest times so
         the points array is sorted by the athletes' respective times*/

        // seperating the objects
        times.splice(0, times.length, ...combinedArr.map(obj => obj.tt));
        pointsIn10.splice(0, pointsIn10.length, ...combinedArr.map(obj => obj.value));

        // cutting off the unnecessary indices
        pointsIn10.splice(10, pointsIn10.length - 10);

        // this calls the function that stores the FIS points in the race
        getPointsInRace(liveTimingData);

        const penalty = penaltyCalculator();

        // modifies the paragraph displaying the penalty!
        document.getElementById("penalty").innerHTML += penalty;
        
        if(document.getElementById("racerBib").value){
            racerScore = parseFloat(racerCalculator(liveTimingData, document.getElementById("racerBib").value)) + parseFloat(penalty);
            console.log(racerScore);

            document.getElementById("racerPoints").innerHTML += racerScore;
        }
        
    }
}

function racerCalculator(file, bib){
    let racepoints;
    var match;

    var regex = new RegExp("(?<=b=" + bib + ".{100,130}tt=).{5,7}", "g");
    match = regex.exec(file);
    let racerTime = match[0];
    console.log(racerTime);

    var timeParts = racerTime.split(":"); // Split the string into minutes and seconds.milliseconds
    var minutes = parseInt(timeParts[0], 10); // Parse the minutes component as an integer
    var secondsMilliseconds = timeParts[1].split("."); // Split the seconds.milliseconds component into seconds and milliseconds
    var seconds = parseInt(secondsMilliseconds[0], 10); // Parse the seconds component as an integer
    var milliseconds = parseInt(secondsMilliseconds[1]); // Parse the milliseconds component as a floating-point number

    racerTime = (minutes * 60) + seconds + (milliseconds / 100); // Convert to total seconds


    
    if(document.getElementById("disciplineSelector").value == "GS"){
        const f = fFactorGS;
        racepoints = (f * racerTime / times[0]) - f;
    }
    else if(document.getElementById("disciplineSelector").value == "SL"){
        const f = fFactorSL;
        racepoints = (f * racerTime / times[0]) - f;
    }
    
    let round = racepoints.toFixed(2);
    racepoints = parseFloat(round);

    return racepoints;
}

/*
this function does all the math (I'm probably going to change this into
a main-type function that calls all the others)
*/
function penaltyCalculator(){

    /*
    these are the factors that go into the penalty calculation
    A is the sum of the fis points of the top 5 skiers in the top ten (based on fis points)
    B is the sum of the fis points of the best 5 athletes that are going into the race (based on fis points)
    C is the sum of the race points of the top 5 skiers in the top ten (based on fis points)
    The formula for the penalty = (A + B - C) / 10
    */

    let a = 0
    let b = 0
    let c = 0


    /*
    now I'm setting up the race point calculation
    
    The formula for race points is:

    = ((F * Tx) / To) - F

    Where F is the 'fudge factor' which is a constant depending on the skiing discipline
    that changes each year (they are defined at the top of the file)

    Where Tx is the time of the given racer

    and where To is the time of the winning racer
    */

    // trying to avoid errors/error testing
    const bestSkiers = returnIndices();
    console.log(times)
    console.log(pointsIn10)
    console.log(pointsInRace)

    // setting the fastest time for calculations
    const fastestTime = times[0];


    // deciding which f factor to use
    if(document.getElementById("disciplineSelector").value == "GS"){
        const f = fFactorGS;

        // calculating the A, B, and C
        for (let i = 0; i < 5; i++){
            /*
            race points formula using bestSkiers array that corresponds to the
            best racers in the top 10
            */
            rpoints[i] = (f * times[bestSkiers[i]] / fastestTime) - f;
            b += (pointsInRace[i] / 100)
            a += pointsIn10[bestSkiers[i]] / 100
            c += rpoints[i];
        }

        // rounding the numbers
        let cround = c.toFixed(2);
        c = parseFloat(cround);

        // here is the formula in action!
        let penalty = (a + b - c) / 10;
        return penalty.toFixed(2);
    }
    else if(document.getElementById("disciplineSelector").value == "SL"){
        const f = fFactorSL;


        // calculating the A, B, and C
        for (let i = 0; i < 5; i++){
            /*
            race points formula using bestSkiers array that corresponds to the
            best racers in the top 10
            */
            rpoints[i] = (f * times[bestSkiers[i]] / fastestTime) - f;
            b += (pointsInRace[i] / 100)
            a += pointsIn10[bestSkiers[i]] / 100
            c += rpoints[i];
        }

        // rounding the numbers
        let cround = c.toFixed(2);
        c = parseFloat(cround);

        // here is the formula in action!
        let penalty = (a + b - c) / 10;
        return penalty.toFixed(2);    
    }
    else {
        // error catching
        alert("You didn't select a discipline. Please refresh the page and try again.")
        return null;
    }

    
}

// this function retrieves the points list for the race and parses out athletes that DNS (did not start)
function getPointsInRace(file){
    // run1, run2, and points arrays declaration
    const r1 = []
    const r2 = []
    const p = []

    // matches everyones points and stores in p[]
    let match;
    let regex = /(?<=fp=)\d{4,5}/g;
    while((match = regex.exec(file)) !== null){
        p.push(match[0]);
    }

    // matches the first three characters of run1 and stores in r1[]
    // what I'm looking for: 'DNS'
    regex = /(?<=r1=).{3}/g;
    while((match = regex.exec(file)) !== null){
        r1.push(match[0]);
    }

    // matches the first three characters of run2 and stores in r2[]
    // what I'm looking for: 'DNS'
    regex = /(?<=r2=).{3}/g;
    while((match = regex.exec(file)) !== null){
        r2.push(match[0]);
    }

    // sorts through all three arrays and eliminates each instance where the athlete DNS
    for (let i = 0; i < p.length; i++){
        if(r1[i] != "DNS" | (r1[i] == "DNF" && r2[i] != "DNS")){
            pointsInRace[i] = p[i];
        }
    }

    // sort them best to worst
    pointsInRace.sort((a, b) => a - b);

    /* this function could have potentially been avoided with more proficiency in regex
    but I tried for a long time to get it but I couldn't :(*/
}

// this function changes the athlete's times to seconds
function timesToSeconds(array) {
    var resultArray = [];
    for (var i = 0; i < array.length; i++) {
      var timeString = array[i];
      var parts = timeString.split(":");
      var minutes = parseInt(parts[0], 10);
      var seconds = parseFloat(parts[1]);
      var totalSeconds = minutes * 60 + seconds;
      resultArray.push(totalSeconds.toFixed(2));
    }
    return resultArray;
}

// this function returns the indices of the top 10 athletes in the race
function returnIndices() {
    let highest = Math.max(pointsIn10);
    let filteredArr = pointsIn10.filter(num => num !== highest);
    let top5 = filteredArr.sort((a, b) => a - b).slice(0, 5);
    let top5Indices = top5.map(num => pointsIn10.indexOf(num));
    top5Indices = top5Indices.map(parseFloat);

    return top5Indices;
}

// reloads page
function reload(){
    location.reload();
}

// makes HTML element read only and faded
function makeReadOnly(elementId) {
    var myInput = document.getElementById(elementId);
    myInput.disabled = true;
    myInput.classList.add("faded");
}